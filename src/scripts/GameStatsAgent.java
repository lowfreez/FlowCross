package com.flowcross.agent;

import java.lang.instrument.Instrumentation;
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class GameStatsAgent implements Runnable {

    private static String debugPath;
    private final String args;
    private final Instrumentation inst;
    private volatile boolean running = true;

    public GameStatsAgent(String args, Instrumentation inst) {
        this.args = args;
        this.inst = inst;
    }

    public static void premain(String args, Instrumentation inst) {
        // Optional debug logging
        if (args != null && args.contains("debug")) {
            debugPath = "agent_debug.log";
        }

        try {
            start(args, inst);
        } catch (Throwable t) {
            // Silently fail to avoid crashing game
        }
    }

    public static void agentmain(String args, Instrumentation inst) {
        premain(args, inst);
    }

    private static void log(String msg) {
        if (debugPath == null)
            return;
        try (FileWriter fw = new FileWriter(debugPath, true)) {
            fw.write(new Date() + ": " + msg + "\n");
        } catch (Exception e) {
        }
    }

    private static void start(String args, Instrumentation inst) {
        GameStatsAgent agent = new GameStatsAgent(args, inst);
        Thread t = new Thread(agent);
        t.setDaemon(true);
        t.setName("FlowCross-Stats");
        t.start();
    }

    @Override
    public void run() {
        String outputPath = args;
        if (outputPath == null || outputPath.isEmpty())
            outputPath = "agent_stats.json";

        Object mcInstance = null;
        Object playerInstance = null;
        Field fpsField = null;
        Field xField = null, yField = null, zField = null;

        while (running) {
            try {
                // 1. Find Minecraft Instance
                if (mcInstance == null) {
                    mcInstance = findMinecraftInstance(inst);
                }

                // 2. Find FPS Field
                if (mcInstance != null && fpsField == null) {
                    fpsField = findFpsFieldInInstance(mcInstance);
                }

                // 3. Find Player Instance (Coordinate source)
                // Heuristic: Field in MC that has double fields x,y,z
                if (mcInstance != null && playerInstance == null) {
                    playerInstance = findPlayerInstance(mcInstance);
                }

                // 4. Find XYZ Fields
                if (playerInstance != null && xField == null) {
                    Field[] doubles = findDoubleFields(playerInstance);
                    if (doubles != null) {
                        xField = doubles[0];
                        yField = doubles[1];
                        zField = doubles[2];
                    }
                }

                // Read Values
                int fps = 0;
                double x = 0, y = 0, z = 0;

                if (fpsField != null) {
                    try {
                        fps = fpsField.getInt(mcInstance);
                    } catch (Exception e) {
                        fpsField = null;
                    }
                }

                if (playerInstance != null && xField != null) {
                    try {
                        x = xField.getDouble(playerInstance);
                        y = yField.getDouble(playerInstance);
                        z = zField.getDouble(playerInstance);
                    } catch (Exception e) {
                        playerInstance = null;
                        xField = null;
                    }
                }

                // Write JSON
                try (FileWriter fw = new FileWriter(outputPath)) {
                    fw.write(
                            String.format(Locale.US, "{\"fps\":%d, \"x\":%.2f, \"y\":%.2f, \"z\":%.2f}", fps, x, y, z));
                }

                Thread.sleep(100);

            } catch (Throwable t) {
                log("Loop error: " + t);
                try {
                    Thread.sleep(2000);
                } catch (Exception e) {
                }
            }
        }
    }

    // --- Helpers ---

    private Object findMinecraftInstance(Instrumentation inst) {
        Class<?>[] classes = inst.getAllLoadedClasses();
        for (Class<?> clazz : classes) {
            if (shouldIgnore(clazz.getName()))
                continue;
            try {
                // Check static method getInstance() -> Class
                for (Method m : clazz.getDeclaredMethods()) {
                    if (Modifier.isStatic(m.getModifiers()) && m.getParameterCount() == 0
                            && m.getReturnType() == clazz) {
                        m.setAccessible(true);
                        Object instance = m.invoke(null);
                        if (instance != null && checkCandidates(instance))
                            return instance;
                    }
                }
                // Check static field instance -> Class
                for (Field f : clazz.getDeclaredFields()) {
                    if (Modifier.isStatic(f.getModifiers()) && f.getType() == clazz) {
                        f.setAccessible(true);
                        Object instance = f.get(null);
                        if (instance != null && checkCandidates(instance))
                            return instance;
                    }
                }
            } catch (Throwable t) {
            }
        }
        return null;
    }

    private Object findPlayerInstance(Object mc) {
        try {
            for (Field f : mc.getClass().getDeclaredFields()) {
                f.setAccessible(true);
                Object candidate = f.get(mc);
                if (candidate != null && !shouldIgnore(candidate.getClass().getName())) {
                    if (hasDoubleFields(candidate))
                        return candidate;
                }
            }
        } catch (Throwable t) {
        }
        return null;
    }

    private boolean hasDoubleFields(Object obj) {
        int doubles = 0;
        for (Field f : obj.getClass().getDeclaredFields()) {
            if (f.getType() == double.class)
                doubles++;
        }
        return doubles >= 3; // X, Y, Z
    }

    private Field[] findDoubleFields(Object player) {
        List<Field> fields = new ArrayList<>();
        for (Field f : player.getClass().getDeclaredFields()) {
            if (f.getType() == double.class) {
                f.setAccessible(true);
                fields.add(f);
            }
        }
        if (fields.size() >= 3) {
            // Start simplistic: first 3 doubles.
            // Better: Check values? X/Y/Z usually large, others (motion) small.
            // For now, return first 3.
            return new Field[] { fields.get(0), fields.get(1), fields.get(2) };
        }
        return null;
    }

    private boolean checkCandidates(Object instance) {
        try {
            int validInts = 0;
            for (Field f : instance.getClass().getDeclaredFields()) {
                if (f.getType() == int.class) {
                    f.setAccessible(true);
                    int val = f.getInt(instance);
                    if (val > 0 && val < 2000)
                        validInts++;
                }
            }
            return validInts > 5;
        } catch (Throwable t) {
        }
        return false;
    }

    private Field findFpsFieldInInstance(Object instance) {
        try {
            for (Field f : instance.getClass().getDeclaredFields()) {
                if (f.getType() == int.class) {
                    f.setAccessible(true);
                    int val = f.getInt(instance);
                    if (val >= 0 && val < 2000)
                        return f; // Simplistic
                }
            }
        } catch (Throwable t) {
        }
        return null;
    }

    private static boolean shouldIgnore(String name) {
        return name.startsWith("java.") || name.startsWith("sun.") || name.startsWith("jdk.") ||
                name.startsWith("org.") || name.startsWith("com.google") || name.startsWith("io.netty");
    }
}
