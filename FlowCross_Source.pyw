# -*- coding: utf-8 -*-
"""
██╗      ██████╗ ██╗    ██╗███████╗██████╗ ███████╗███████╗███████╗
██║     ██╔═══██╗██║    ██║██╔════╝██╔══██╗██╔════╝██╔════╝╚══███╔╝
██║     ██║   ██║██║ █╗ ██║█████╗  ██████╔╝█████╗  █████╗    ███╔╝ 
██║     ██║   ██║██║███╗██║██╔══╝  ██╔══██╗██╔══╝  ██╔══╝   ███╔╝  
███████╗╚██████╔╝╚███╔███╔╝██║     ██║  ██║███████╗███████╗███████╗
╚══════╝ ╚═════╝  ╚══╝╚══╝ ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
"""

from pathlib import Path
import os
import sys
import json
import uuid
import platform
import subprocess
import threading
import shutil
import psutil
import time
import logging
import ctypes
from ctypes import wintypes
import requests
import win32gui
import win32con
import win32process

try:
    from plyer import notification
    _na = True
except:
    _na = False

def _fn_1(title):
    def _cb(hwnd, extra):
        text = win32gui.GetWindowText(hwnd)
        if text:
            extra.append((hwnd, text))
    _hwnds = []
    win32gui.EnumWindows(_cb, _hwnds)
    for hwnd, text in _hwnds:
        if title in text:
            return hwnd
    return 0

def _fn_2(pid):
    def _cb(hwnd, extra):
        _, found_pid = win32process.GetWindowThreadProcessId(hwnd)
        if found_pid == pid and win32gui.IsWindowVisible(hwnd):
            extra.append(hwnd)
    _hwnds = []
    win32gui.EnumWindows(_cb, _hwnds)
    return _hwnds[0] if _hwnds else 0

def _fn_3(hwnd, x, y):
    _sf = [False]
    def _mp():
        while not _sf[0]:
            try:
                _rect = wintypes.RECT()
                if not win32gui.GetWindowRect(hwnd, ctypes.byref(_rect)):
                    break
                if _rect.left != x or _rect.top != y:
                    win32gui.SetWindowPos(hwnd, None, x, y, 0, 0, 
                                        win32con.SWP_NOSIZE | win32con.SWP_NOZORDER | win32con.SWP_NOACTIVATE)
                time.sleep(0.05)
            except:
                break
    _t = threading.Thread(target=_mp)
    _t.daemon = True
    _t.start()
    return _sf

try:
    from pyarmor_runtime import pyarmor
except ImportError:
    pyarmor = None

def _fn_4(hwnd, radius=16):
    _u32 = ctypes.windll.user32
    _g32 = ctypes.windll.gdi32
    _rect = wintypes.RECT()
    _u32.GetWindowRect(hwnd, ctypes.byref(_rect))
    _w = _rect.right - _rect.left
    _h = _rect.bottom - _rect.top
    _rgn = _g32.CreateRoundRectRgn(0, 0, _w + 1, _h + 1, radius * 2, radius * 2)
    _u32.SetWindowRgn(hwnd, _rgn, True)

def _fn_5():
    _u32 = ctypes.windll.user32
    _w = _u32.GetSystemMetrics(0)
    _h = _u32.GetSystemMetrics(1)
    return _w, _h

class _cls_1:
    def __init__(self):
        self._log = logging.getLogger('FlowCross')
        self._log.setLevel(logging.ERROR)
        _ld = Path(os.getenv('APPDATA')) / '.fllaunch' / 'logs'
        _ld.mkdir(parents=True, exist_ok=True)
        _h = logging.FileHandler(_ld / 'error.log', encoding='utf-8')
        _h.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self._log.addHandler(_h)
        self._cfg = self._fn_6()
        self._prof = self._fn_7()
        if not self._cfg.get('java_path'):
            self._cfg['java_path'] = self._fn_8()
            self._fn_9(self._cfg)
        self._win = None
    def _fn_10(self):
        if platform.system() == 'Windows':
            _mcd = Path(os.getenv('APPDATA')) / '.minecraft'
        elif platform.system() == 'Darwin':
            _mcd = Path.home() / 'Library' / 'Application Support' / 'minecraft'
        else:
            _mcd = Path.home() / '.minecraft'
        if _mcd.exists():
            return str(_mcd)
        return str(Path.home() / '.minecraft')
    def _fn_11(self, version):
        try:
            _vp = version.split('.')
            if len(_vp) >= 2:
                _maj = int(_vp[0])
                _min = int(_vp[1]) if len(_vp) > 1 else 0
                if _maj >= 21 or (_maj == 1 and _min >= 21):
                    return 21
                elif _maj == 1 and 18 <= _min <= 20:
                    return 17
                elif _maj == 1 and _min == 17:
                    return 16
                else:
                    return 8
        except (ValueError, IndexError):
            pass
        return 17
    def _fn_8(self, required_java_version=None):
        import shutil
        _cp = [
            r'C:\Program Files\Java',
            r'C:\Program Files (x86)\Java',
            os.path.expanduser('~/.jdks')
        ]
        _jv = []
        for _p in _cp:
            if os.path.exists(_p):
                try:
                    for _d in os.listdir(_p):
                        if _d.startswith('jdk') or _d.startswith('jre'):
                            if _d.startswith('jdk-'):
                                _vs = _d.replace('jdk-', '').split('.')[0]
                            elif _d.startswith('jre-'):
                                _vs = _d.replace('jre-', '').split('.')[0]
                            elif _d.startswith('jre'):
                                _vs = _d.replace('jre', '').split('.')[0]
                                if _vs.startswith('1.'):
                                    _vs = _vs.replace('1.', '')
                            else:
                                continue
                            try:
                                _vn = int(_vs)
                                _jv.append((_vn, _d, _p))
                            except ValueError:
                                continue
                except:
                    pass
        _jv.sort(key=lambda x: x[0], reverse=True)
        if required_java_version:
            for _vn, _dn, _p in _jv:
                if _vn >= required_java_version:
                    _je = os.path.join(_p, _dn, 'bin', 'javaw.exe')
                    if os.path.exists(_je):
                        return _je
                    _je = os.path.join(_p, _dn, 'bin', 'java.exe')
                    if os.path.exists(_je):
                        return _je
        for _vn, _dn, _p in _jv:
            _je = os.path.join(_p, _dn, 'bin', 'javaw.exe')
            if os.path.exists(_je):
                return _je
            _je = os.path.join(_p, _dn, 'bin', 'java.exe')
            if os.path.exists(_je):
                return _je
        _jh = os.environ.get('JAVA_HOME')
        if _jh:
            _je = os.path.join(_jh, 'bin', 'javaw.exe')
            if os.path.exists(_je):
                return _je
            _je = os.path.join(_jh, 'bin', 'java.exe')
            if os.path.exists(_je):
                return _je
        _je = shutil.which('javaw')
        if _je:
            return _je
        _je = shutil.which('java')
        if _je:
            return _je
        return ''
    def _fn_6(self):
        _cp = Path(os.getenv('APPDATA')) / '.fllaunch' / 'config.json'
        _cp.parent.mkdir(parents=True, exist_ok=True)
        _sw, _sh = _fn_5()
        _dw = _sw // 2
        _dh = _sh // 2
        if _cp.exists():
            with open(_cp, 'r', encoding='utf-8') as f:
                _c = json.load(f)
                if not _c.get('minecraft_dir'):
                    _c['minecraft_dir'] = self._fn_10()
                return _c
        return {
            'minecraft_dir': self._fn_10(),
            'last_version': '',
            'language': 'ru',
            'theme': 'dark',
            'accent_color': '#0335fc',
            'java_path': '',
            'jvm_args': '',
            'width': _dw,
            'height': _dh,
            'fullscreen': False,
            'keep_launcher_open': False,
            'show_snapshots': True,
            'show_old_versions': False,
            'show_fabric': True,
            'show_forge': True,
            'show_quilt': True,
            'show_neoforge': True,
            'gpu_mode': 'auto',
            'verify_files': True,
            'current_profile': None,
            'launcher_width': 1200,
            'launcher_height': 800
        }
    def _fn_7(self):
        _pp = Path(os.getenv('APPDATA')) / '.fllaunch' / 'profiles.json'
        _pp.parent.mkdir(parents=True, exist_ok=True)
        if _pp.exists():
            with open(_pp, 'r', encoding='utf-8') as f:
                _pr = json.load(f)
            _upd = False
            for _p in _pr:
                if 'uuid' not in _p or not isinstance(_p.get('uuid'), str) or not _p.get('uuid', '').strip():
                    _p['uuid'] = str(uuid.uuid3(uuid.NAMESPACE_DNS, _p.get('username', 'Player')))
                    _upd = True
                if 'ram' not in _p or not isinstance(_p.get('ram'), int) or _p.get('ram', 0) <= 0:
                    _p['ram'] = 4096
                    _upd = True
                if 'username' not in _p or not isinstance(_p.get('username'), str):
                    _p['username'] = 'Player'
                    _upd = True
            if _upd:
                with open(_pp, 'w', encoding='utf-8') as f:
                    json.dump(_pr, f, indent=4, ensure_ascii=False)
            return _pr
        _dp = {
            'id': str(uuid.uuid4()),
            'username': 'Player',
            'ram': 4096,
            'type': 'offline',
            'uuid': str(uuid.uuid3(uuid.NAMESPACE_DNS, 'Player')),
            'avatar': ''
        }
        return [_dp]
    def _fn_9(self, _cd):
        self._cfg.update(_cd)
        _cp = Path(os.getenv('APPDATA')) / '.fllaunch' / 'config.json'
        with open(_cp, 'w', encoding='utf-8') as f:
            json.dump(self._cfg, f, indent=4, ensure_ascii=False)
        if _na:
            try:
                notification.notify(title='Настройки сохранены', message='Все настройки успешно сохранены', app_name='FlowCross Launcher', timeout=5)
            except:
                pass
        if 'launcher_width' in _cd or 'launcher_height' in _cd:
            _nw = self._cfg.get('launcher_width', 1200)
            _nh = self._cfg.get('launcher_height', 800)
            if self._win:
                self._win.resize(_nw, _nh)
        return {'success': True}
    def save_config(self, _cd):
        return self._fn_9(_cd)
    def get_config(self):
        return self._cfg
    def get_profiles(self):
        return self._prof
    def get_current_profile(self):
        _pid = self._cfg.get('current_profile')
        if _pid:
            for _p in self._prof:
                if _p['id'] == _pid:
                    return _p
        return self._prof[0] if self._prof else None
    def create_profile(self, _un, _ram):
        _np = {
            'id': str(uuid.uuid4()),
            'username': _un,
            'ram': _ram,
            'type': 'offline',
            'uuid': str(uuid.uuid3(uuid.NAMESPACE_DNS, _un)),
            'avatar': ''
        }
        self._prof.append(_np)
        _pp = Path(os.getenv('APPDATA')) / '.fllaunch' / 'profiles.json'
        with open(_pp, 'w', encoding='utf-8') as f:
            json.dump(self._prof, f, indent=4, ensure_ascii=False)
        if _na:
            try:
                notification.notify(title='Профиль создан', message=f'Профиль {_un} успешно создан', app_name='FlowCross Launcher', timeout=5)
            except:
                pass
        return {'success': True, 'profile': _np}
    def switch_profile(self, _pid):
        for _p in self._prof:
            if _p['id'] == _pid:
                self._cfg['current_profile'] = _pid
                self._fn_9(self._cfg)
                return {'success': True, 'profile': _p}
        return {'success': False, 'error': 'Профиль не найден'}
    def delete_profile(self, _pid):
        self._prof = [p for p in self._prof if p['id'] != _pid]
        if self._cfg.get('current_profile') == _pid:
            self._cfg['current_profile'] = self._prof[0]['id'] if self._prof else None
            self._fn_9(self._cfg)
        _pp = Path(os.getenv('APPDATA')) / '.fllaunch' / 'profiles.json'
        with open(_pp, 'w', encoding='utf-8') as f:
            json.dump(self._prof, f, indent=4, ensure_ascii=False)
        return {'success': True}
    def get_system_info(self):
        return {
            'total_ram': round(psutil.virtual_memory().total / (1024**3), 1),
            'available_ram': round(psutil.virtual_memory().available / (1024**3), 1),
            'cpu_count': psutil.cpu_count(),
            'platform': platform.system()
        }
    def is_game_running(self):
        for _proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if _proc.info['name'] == 'javaw.exe' or _proc.info['name'] == 'java.exe':
                    _cl = _proc.info['cmdline']
                    if _cl and any('minecraft' in arg.lower() or 'net.minecraft' in arg for arg in _cl):
                        return True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return False
    def get_game_status(self):
        return {'running': self.is_game_running()}
    def get_versions(self):
        try:
            import minecraft_launcher_lib
            _v = minecraft_launcher_lib.utils.get_version_list()
            if not _v:
                _v = [
                    {'id': '1.21.1', 'type': 'release'},
                    {'id': '1.20.6', 'type': 'release'},
                    {'id': '1.19.4', 'type': 'release'},
                    {'id': '1.18.2', 'type': 'release'},
                    {'id': '1.17.1', 'type': 'release'},
                    {'id': '1.16.5', 'type': 'release'},
                ]
            _r = []
            for v in _v:
                _vt = v.get('type', 'release')
                _r.append({
                    'id': v['id'],
                    'type': _vt,
                    'loader': 'vanilla',
                    'installed': self._fn_12(v['id'])
                })
            if self._cfg.get("show_old_versions", False):
                _ov = [
                    {'id': 'b1.7.3', 'type': 'old_beta'},
                    {'id': 'b1.6.6', 'type': 'old_beta'},
                    {'id': 'b1.5_01', 'type': 'old_beta'},
                    {'id': 'a1.2.6', 'type': 'old_alpha'},
                    {'id': 'a1.2.5', 'type': 'old_alpha'},
                    {'id': 'a1.2.4_01', 'type': 'old_alpha'},
                    {'id': 'a1.2.3_04', 'type': 'old_alpha'},
                    {'id': 'a1.2.2b', 'type': 'old_alpha'},
                    {'id': 'a1.2.1_01', 'type': 'old_alpha'},
                    {'id': 'a1.1.2_01', 'type': 'old_alpha'},
                    {'id': 'a1.0.17_04', 'type': 'old_alpha'},
                    {'id': 'a1.0.16', 'type': 'old_alpha'},
                    {'id': 'a1.0.15', 'type': 'old_alpha'},
                    {'id': 'a1.0.14', 'type': 'old_alpha'},
                    {'id': 'a1.0.11', 'type': 'old_alpha'},
                    {'id': 'a1.0.5_01', 'type': 'old_alpha'},
                    {'id': 'a1.0.4', 'type': 'old_alpha'},
                    {'id': 'inf-20100618', 'type': 'old_alpha'},
                    {'id': 'inf-20100616', 'type': 'old_alpha'},
                    {'id': 'c0.30_01c', 'type': 'old_alpha'},
                    {'id': 'c0.0.13a', 'type': 'old_alpha'},
                    {'id': 'c0.0.11a', 'type': 'old_alpha'},
                    {'id': 'rd-161348', 'type': 'old_alpha'},
                    {'id': 'rd-160052', 'type': 'old_alpha'},
                    {'id': 'rd-132328', 'type': 'old_alpha'},
                    {'id': 'rd-132211', 'type': 'old_alpha'},
                ]
                for v in _ov:
                    _r.append({
                        'id': v['id'],
                        'type': v['type'],
                        'loader': 'vanilla',
                        'installed': self._fn_12(v['id'])
                    })
            return {'success': True, 'versions': _r}
        except Exception as e:
            _r = [
                {'id': '1.20.6', 'type': 'release', 'loader': 'vanilla', 'installed': False},
                {'id': '1.19.4', 'type': 'release', 'loader': 'vanilla', 'installed': False},
                {'id': '1.18.2', 'type': 'release', 'loader': 'vanilla', 'installed': False},
                {'id': '1.17.1', 'type': 'release', 'loader': 'vanilla', 'installed': False},
                {'id': '1.16.5', 'type': 'release', 'loader': 'vanilla', 'installed': False},
            ]
            return {'success': True, 'versions': _r}
    def _fn_12(self, _vid):
        _pts = _vid.split('-')
        if len(_pts) == 2:
            _mcv, _lv = _pts
            _vd = Path(self._cfg['minecraft_dir']) / 'versions' / f"fabric-loader-{_mcv}-{_lv}"
        elif len(_pts) == 3:
            _vd = Path(self._cfg['minecraft_dir']) / 'versions' / f"forge-{_vid}"
        else:
            _vd = Path(self._cfg['minecraft_dir']) / 'versions' / _vid
        return _vd.exists()
    def open_folder(self, _ft):
        try:
            if _ft == 'game':
                _f = self._cfg['minecraft_dir']
            elif _ft == 'mods':
                _f = str(Path(self._cfg['minecraft_dir']) / 'mods')
                Path(_f).mkdir(exist_ok=True)
            elif _ft == 'launcher':
                _f = str(Path(os.getenv('APPDATA')) / '.fllaunch')
            else:
                return {'success': False, 'error': 'Неизвестный тип папки'}
            if platform.system() == 'Windows':
                os.startfile(_f)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    def install_version(self, _vid):
        def _it():
            try:
                if _na:
                    try:
                        notification.notify(title='Установка версии', message=f'Начинается установка {_vid}', app_name='FlowCross Launcher', timeout=5)
                    except:
                        pass
                import minecraft_launcher_lib
                _pts = _vid.split('-')
                if len(_pts) == 2:
                    _mcv, _lv = _pts
                    from minecraft_launcher_lib.fabric import install_fabric
                    install_fabric(_mcv, _lv, self._cfg['minecraft_dir'])
                elif len(_pts) == 3:
                    from minecraft_launcher_lib.forge import install_forge
                    install_forge(_vid, self._cfg['minecraft_dir'])
                else:
                    minecraft_launcher_lib.install.install_minecraft_version(_vid, self._cfg['minecraft_dir'])
                if _na:
                    try:
                        notification.notify(title='Установка завершена', message=f'Версия {_vid} успешно установлена', app_name='FlowCross Launcher', timeout=5)
                    except:
                        pass
                if self._win:
                    try:
                        self._win.evaluate_js('installComplete()')
                    except:
                        pass
            except Exception as e:
                if _na:
                    try:
                        notification.notify(title='Ошибка установки', message=f'Не удалось установить версию: {str(e)}', app_name='FlowCross Launcher', timeout=5)
                    except:
                        pass
                if self._win:
                    try:
                        self._win.evaluate_js(f'installError("{str(e)}")')
                    except:
                        pass
                self._log.error(f"Install error for version {_vid}: {str(e)}", exc_info=True)
        _t = threading.Thread(target=_it)
        _t.daemon = True
        _t.start()
        return {'success': True, 'message': 'Installation started'}
    def launch_game(self, _pid, _v):
        try:
            _pid = _pid.get('id') if isinstance(_pid, dict) else _pid
            _v = _v.get('id') if isinstance(_v, dict) else _v
            if not _v or not isinstance(_v, str) or not _v.strip():
                return {'success': False, 'error': 'Версия не выбрана'}
            if self.is_game_running():
                return {'success': False, 'error': 'game_running', 'message': 'Игра уже запущена. Запустить ещё одну сессию?'}
            _mcd = self._cfg['minecraft_dir']
            try:
                import minecraft_launcher_lib
                _vi = minecraft_launcher_lib.utils.get_installed_versions(_mcd)
                _ivs = [v['id'] for v in _vi]
                if _v not in _ivs:
                    try:
                        minecraft_launcher_lib.install.install_minecraft_version(_v, _mcd)
                        _vi = minecraft_launcher_lib.utils.get_installed_versions(_mcd)
                        _ivs = [v['id'] for v in _vi]
                        if _v not in _ivs:
                            return {'success': False, 'error': f'Не удалось установить версию {_v}'}
                    except Exception as _ie:
                        return {'success': False, 'error': f'Ошибка установки версии {_v}: {str(_ie)}'}
                _vd = Path(_mcd) / 'versions' / _v
                _jf = _vd / f'{_v}.jar'
                if not _jf.exists():
                    return {'success': False, 'error': f'Jar файл для версии {_v} не найден. Переустановите версию.'}
            except Exception as e:
                pass
            _prof = None
            for p in self._prof:
                if p['id'] == _pid:
                    _prof = p
                    break
            if not _prof:
                return {'success': False, 'error': 'Профиль не найден'}
            _un = str(_prof.get('username', 'Player')).strip() or 'Player'
            _uv = _prof.get('uuid', '')
            if isinstance(_uv, str) and _uv.strip():
                _us = _uv.strip()
            else:
                _us = str(uuid.uuid3(uuid.NAMESPACE_DNS, _un))
            _tk = str(_prof.get('token', '')).strip()
            _rm = max(1024, int(_prof.get('ram', 4096)))
            _w = max(800, int(self._cfg.get('width', 1920)))
            _h = max(600, int(self._cfg.get('height', 1080)))
            _fs = self._cfg.get('fullscreen', False)
            _rj = self._fn_11(_v)
            _jp = str(self._cfg.get('java_path', '')).strip()
            if not _jp:
                _jp = self._fn_8(_rj)
                if not _jp:
                    _jp = self._fn_8()
            if not _jp:
                return {'success': False, 'error': f'Java не найдена. Установите Java для запуска Minecraft.'}
            _jvma = [f'-Xmx{_rm}M', f'-Xms{_rm}M']
            _cjvm = str(self._cfg.get('jvm_args', '')).strip()
            if _cjvm:
                _jvma.extend(_cjvm.split())
            _jvma.append('-Dfml.debug=false')
            _jvma.append('-Dminecraft.debug=false')
            _jvma = [arg for arg in _jvma if not arg.startswith('--sun-misc-unsafe-memory-access')]
            _opts = {
                'username': _un,
                'uuid': _us,
                'token': _tk,
                'jvmArguments': _jvma,
                'gameDirectory': _mcd,
                'executablePath': _jp
            }
            _sw, _sh = _fn_5()
            if _w >= _sw:
                _w = _sw - 1
            if _h >= _sh:
                _h = _sh - 1
            _opts['customResolution'] = True
            _opts['resolutionWidth'] = str(_w)
            _opts['resolutionHeight'] = str(_h)
            import minecraft_launcher_lib
            _cmd = minecraft_launcher_lib.command.get_minecraft_command(
                _v, 
                _mcd, 
                _opts
            )
            if self._win:
                self._win.evaluate_js(f'addToConsole("Запуск Minecraft {_v} с Java: {_jp}")')
                self._win.evaluate_js(f'addToConsole("Рабочая директория: {_mcd}")')
                self._win.evaluate_js(f'addToConsole("Команда: {" ".join(_cmd[:3])}...")')
            if platform.system() == 'Windows':
                _proc = subprocess.Popen(
                    _cmd, 
                    cwd=_mcd, 
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
                )
            else:
                _proc = subprocess.Popen(
                    _cmd, 
                    cwd=_mcd, 
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    preexec_fn=os.setsid
                )
            if self._win:
                self._win.evaluate_js(f'addToConsole("Процесс запущен с PID: {_proc.pid}")')
            time.sleep(1)
            if _proc.poll() is None:
                if self._win:
                    self._win.evaluate_js('addToConsole("Процесс работает успешно")')
            else:
                if self._win:
                    self._win.evaluate_js(f'addToConsole("Процесс завершился немедленно с кодом: {_proc.returncode}")')
                return {'success': False, 'error': f'Процесс завершился с кодом {_proc.returncode}'}
            self._cfg['last_version'] = _v
            self._fn_9(self._cfg)
            return {'success': True, 'message': 'Игра запущена'}
        except Exception as e:
            return {'success': False, 'error': f'Ошибка запуска: {str(e)}'}
    def launch_game_force(self, _pid, _v):
        _oc = self.is_game_running
        self.is_game_running = lambda: False
        try:
            return self.launch_game(_pid, _v)
        finally:
            self.is_game_running = _oc
    def minimize_window(self):
        return self._fn_13()
    def _fn_13(self):
        _hwnd = _fn_1('FlowCross Launcher')
        if _hwnd:
            win32gui.ShowWindow(_hwnd, win32con.SW_MINIMIZE)
        return {'success': True}
    def get_modpacks(self):
        try:
            _r = requests.get('https://api.modrinth.com/v2/search?facets=[["project_type:modpack"]]&limit=20')
            _d = _r.json()
            _mp = []
            for _h in _d['hits']:
                _mp.append({
                    'id': _h['project_id'],
                    'title': _h['title'],
                    'description': _h['description'],
                    'downloads': _h['downloads'],
                    'icon_url': _h.get('icon_url', ''),
                    'versions': _h.get('versions', [])
                })
            return {'success': True, 'modpacks': _mp}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    def close_window(self):
        return self._fn_14()
    def _fn_14(self):
        _hwnd = _fn_1('FlowCross Launcher')
        if _hwnd:
            win32gui.PostMessage(_hwnd, win32con.WM_CLOSE, 0, 0)
        time.sleep(0.1)
        os._exit(0)

def main():
    _api = _cls_1()
    _cfg = _api._cfg
    _w = _cfg.get('launcher_width', 1200)
    _h = _cfg.get('launcher_height', 800)
    _hp = Path(__file__).parent / 'flowcross.html'
    if _hp.exists():
        with open(_hp, 'r', encoding='utf-8') as f:
            _hc = f.read()
    else:
        return
    import webview
    _win = webview.create_window('FlowCross Launcher', html=_hc, js_api=_api, width=_w, height=_h, frameless=True, resizable=False)
    _api._win = _win
    if platform.system() == 'Windows':
        def _los():
            time.sleep(0.5)
            _hwnd = _fn_1('FlowCross Launcher')
            if _hwnd:
                _rect = wintypes.RECT()
                win32gui.GetWindowRect(_hwnd, ctypes.byref(_rect))
                _fn_3(_hwnd, _rect.left, _rect.top)
        _t = threading.Thread(target=_los)
        _t.daemon = True
        _t.start()
    webview.start(debug=False)

if __name__ == '__main__':
    main()
