<div align="center">
 
![FlowCross Banner](https://pmqpixsjrevmngxvearu.supabase.co/storage/v1/object/public/api/flowcrossbanner.png)

**Современный, модульный и высокопроизводительный игровой лаунчер нового поколения для Minecraft**

[![Version](https://img.shields.io/badge/Version-0.26.11%20-5444fa?style=for-the-badge)](package.json)
[![Minecraft](https://img.shields.io/badge/Minecraft-Vanilla%20%7C%20Fabric%20%7C%20Forge%20%7C%20Quilt-5444fa?style=for-the-badge&logo=minecraft&logoColor=white)](https://www.minecraft.net)
[![Stack](https://img.shields.io/badge/Stack-Electron%20%7C%20React%2019%20%7C%20TypeScript%20%7C%20Vite-5444fa?style=for-the-badge)](package.json)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20Linux-5444fa?style=for-the-badge)](package.json)

</div>

---

## ✦ О проекте

**FlowCross** — крутой лаунчер Minecraft с открытым исходным кодом, сделанный с акцентом на скорость работы и визуальную эстетику.

скоро исходный код, наверное

---

## ✦ Ключевые возможности

- **Изолированные инстансы**:
  - Полная автономия каждой сборки - независимые каталоги модов, конфигураций, миров и ресурспаков.
  - Поддержка нативного формата сборок `.fmp` (FlowCross Modpack), модпаков Modrinth (`.mrpack`) и импорта из Prism Launcher.
- **Поддержка актуальных модлоадеров**:
  - Совместимость с **Vanilla**, **Fabric**, **Forge** и **Quilt** с автоматической проверкой всё ли ок.
- **Интеграция с Modrinth**:
  - Встроенный поиск модов, шейдеров и текстурпаков через официальный API.
  - Установка ресурсов (модов, шейдеров итд) в выбранный инстанс в один клик под версию клиента.
- **Плагины FlowCross (`.plugin`)**:
- **Глубокая кастомизация и интерфейс**:
  - Темная и светлая темы, палитра кастомных акцентов и всякое ещё там да.
  - Гибкая навигация: классический боковой сайдбар либо компактный нижний докбар, а ещё тулбар но он ушербный.

---

## ✦ Стек технологий

| Категория | Технологии |
|---|---|
| **Архитектура** | Electron, Node.js (ESM), безопасный IPC-мост (`preload`) |
| **Фронт** | React 19, TypeScript, Vite, Tailwind CSS, Motion |
| **Графика** | Three.js, skinview3d |
| **Запуск игры** | @xmcl/core, @xmcl/installer, eml-lib (почти не используется) |
| **Плагины** | Monolithic FLP1 Binary Container, Kotlin DSL CLI (`openplugin`) |

---

## ✦ Быстрый старт

### Требования
- **Node.js** 20+
- **pnpm** 9+

### Установка и запуск

```bash
# Клонирование репозитория
git clone https://github.com/lowfreez/FlowCross.git

# Переход в директорию проекта
cd FlowCross

# Установка зависимостей
pnpm install

# Запуск в режиме разработки (Vite)
pnpm dev

# Запуск приложения в среде Electron
pnpm start
```

---

## ✦ Сборка дистрибутива

```bash
# Сборка NSIS установщика под Windows
pnpm build:win

# Сборка портативной версии (Portable)
pnpm build:portable

# Сборка пакетов под Linux (AppImage, deb, tar.gz)
pnpm build:linux
```

---

## ✦ Разработка плагинов

Лаунчер содержит встроенную утилиту для создания и сборки плагинов:

```bash
# Инициализация структуры нового плагина
pnpm op init my-plugin

# Сборка плагина в бинарный пакет .plugin
pnpm op build

# Инспекция существующего контейнера
pnpm op inspect my-plugin.plugin
```

---

## ✦ Лицензия

Проект распространяется под [определённой лицензией](LICENSE).
