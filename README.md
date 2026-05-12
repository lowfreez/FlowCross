<div align="center">

  <img src="https://meta.elytra.ltd/storage/v1/object/public/FlowCross/assets/icon.png" alt="FlowCross Logo" width="126" height="126">

  # FlowCross Launcher

  **FlowCross** - это современный, почти быстрый и интуитивно понятный лаунчер для Minecraft.  
  Ориентирован на удобство, чистоту интерфейса и легкость управления игровыми процессами.

  [![GitHub release](https://img.shields.io/github/v/release/lowfreez/FlowCross?style=for-the-badge&color=7C3AED)](https://github.com/lowfreez/FlowCross/releases)
  [![GitHub stars](https://img.shields.io/github/stars/lowfreez/FlowCross?style=for-the-badge&color=F59E0B)](https://github.com/lowfreez/FlowCross/stargazers)
  [![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge&color=3B82F6)](https://github.com/lowfreez/FlowCross)
  [![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE)

</div>

---

## Вот такое можно:

*   **Мега быстры запуск:** Оптимизированная загрузка и круто наверное
*   **Управление профилями:** Легко создавайте и настраивайте профили с удобны интерфейсом
*   **Официальный манифест:** Прямая загрузка версий из манифеста Mojang а не из подвала
*   **Ну вы такой дизайн не видели:** Интерфейс на HTML и CSS с поддержкой любых шрифтов че пожелаете
*   **Авто апдейты:** Всегда самая крутая версия лаунчера благодаря интеграции с `electron-updater`.
*   **Адаптивность:** Полная поддержка Windows и Linux. (ну почти)
*   **Гибкая настройка:** Полный контроль над путями установки и параметрами запуска.

---

## Стек крч

FlowCross построен на базе самых современных веб-технологий:

- **Ядро:** [Electron](https://www.electronjs.org/)
- **УИ:** HTML5 / Vanilla CSS / [JavaScript](https://cdn.mtdv.me/video/rick.mp4)
- **Анимашке:** [Framer Motion](https://www.framer.com/motion/)
- **Стораг, хранилище крч:** `electron-store` для не надежного хранения локальных данных
- **Рендер:** [Three.js](https://threejs.org/) для рендеринга

---

## Установка и запуск

### Для пользователей
Скачайте последнюю версию инсталлятора со страницы [Releases](https://github.com/lowfreez/FlowCross/releases) или с [офиц сайта](https://dl.fllaun.ch)

### Для разрабов
Если вы хотите собрать лаунчер самостоятельно:

1.  Клонируйте репозиторий:
    ```bash
    git clone https://github.com/lowfreez/FlowCross.git
    cd FlowCross
    ```
2.  Установите зависимости:
    ```bash
    npm install
    cd react-ui && npm install && cd ..
    ```
3.  Запустите в режиме разработки:
    ```bash
    npm run dev
    ```
4.  Соберите билд:
    ```bash
    npm run build
    ```

p.s ***Код предоставлен не полностью, некоторые модули отвечающие за бд отсутствуют в мерах безопасности крч вы знаете***

---

## Участие в разработке

Мы приветствуем любую помощь! Если вы нашли ошибку или хотите предложить новую функцию:
1. Шуруете на forum.fllaun.ch
2. Описываете мега круто проблему, чем круче - тем лучше 

---

## Лицензия

Проект распространяется под лицензией **Proprietary**. 
код смотрите, у себя локально делайте че хотите, но выкладывать никуда нельзя, ни код, ни сборки. хотите чет свое на базе этого пишите на форум
<div align="center">


</div>
