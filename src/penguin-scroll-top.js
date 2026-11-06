(function () {
    'use strict';
    var SCRIPT_NAME = '企鹅生成后回顶3';
    console.log('[' + SCRIPT_NAME + '] 脚本开始执行');

    // ---------- 常量 ----------
    var STORE_KEY = 'penguin_scroll_top3.mode'; // 3.0 起用新键，不继承旧版本可能残留的“手动”偏好
    var AUTO_WINDOW_MS = 6000;    // 生成结束后的锚定时长
    var MANUAL_WINDOW_MS = 2000;  // 手动按钮的锚定时长
    var IFRAME_EXTEND_MS = 1200;  // 楼层卡片渲染完成时追加的锚定时长
    var MAX_WINDOW_MS = 10000;    // 锚定时长上限
    var TICK_MS = 80;             // 校正周期
    var START_DELAY_MS = 120;     // 生成结束后先让酒馆完成自己的收尾滚动
    var PINNED_WINDOW_MS = 1500;  // 楼层渲染事件刚触发过多久内，把该楼层钉定为锚定目标

    // ---------- 存取与提示 ----------
    function storageWin() {
        var candidates = [];
        try { if (window.top) candidates.push(window.top); } catch (e) { /* 忽略 */ }
        try { if (window.parent && candidates.indexOf(window.parent) === -1) candidates.push(window.parent); } catch (e) { /* 忽略 */ }
        if (candidates.indexOf(window) === -1) candidates.push(window);
        for (var i = 0; i < candidates.length; i++) {
            try { candidates[i].localStorage.getItem(STORE_KEY); return candidates[i]; } catch (e) { /* 换下一个 */ }
        }
        return window;
    }
    function getMode() {
        try { return storageWin().localStorage.getItem(STORE_KEY) === 'manual' ? 'manual' : 'auto'; }
        catch (e) { return 'auto'; }
    }
    function setMode(mode) {
        try { storageWin().localStorage.setItem(STORE_KEY, mode); } catch (e) { /* 存不了就仅本次生效 */ }
    }
    function echo(message) {
        try {
            if (typeof toastr !== 'undefined') { toastr.info(message, SCRIPT_NAME); return; }
        } catch (e) { /* 提示失败不影响功能 */ }
        try {
            if (typeof triggerSlash === 'function') { triggerSlash('/echo ' + message); return; }
        } catch (e) { /* 提示失败不影响功能 */ }
        console.log('[' + SCRIPT_NAME + '] ' + message);
    }

    // ---------- 宿主页面选择：取“确实渲染着楼层”的那个文档 ----------
    // 脚本运行在无沙盒 iframe 中，官方示例用 window.parent 访问主页面；
    // 个别嵌套/主题环境里楼层在更上层的 window.top，逐个验证后选用。
    function pickHostWin() {
        var candidates = [];
        try { if (window.top && window.top.document) candidates.push(window.top); } catch (e) { /* 忽略 */ }
        try { if (window.parent && window.parent.document && candidates.indexOf(window.parent) === -1) candidates.push(window.parent); } catch (e) { /* 忽略 */ }
        try { if (window.document && candidates.indexOf(window) === -1) candidates.push(window); } catch (e) { /* 忽略 */ }
        for (var i = 0; i < candidates.length; i++) {
            try {
                if (candidates[i].document.querySelector('.mes[mesid]')) return candidates[i];
            } catch (e) { /* 跨域或未就绪，换下一个 */ }
        }
        try { if (window.parent && window.parent.document) return window.parent; } catch (e) { /* 忽略 */ }
        return window;
    }

    // ---------- 楼层定位：每次校正都重新查询，酒馆重渲染后旧节点失效也能自动重新定位 ----------
    function findFloorElement(doc, messageId) {
        var list = doc.querySelectorAll('.mes[mesid]');
        if (!list.length) return null;
        var el = null;
        if (typeof messageId === 'number' && !isNaN(messageId)) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].getAttribute('mesid') === String(messageId)) { el = list[i]; break; }
            }
        }
        if (!el) el = list[list.length - 1];
        if (el && el.clientHeight === 0) {
            // 目标楼层当前不可见（被隐藏）时，退而取最后一个可见楼层
            for (var j = list.length - 1; j >= 0; j--) {
                if (list[j].isConnected && list[j].clientHeight > 0) { el = list[j]; break; }
            }
        }
        return el && el.isConnected ? el : null;
    }

    // ---------- 可滚动性验证：overflow 允许滚动且内容确实超高 ----------
    function isScrollable(w, el) {
        try {
            var oy = w.getComputedStyle(el).overflowY;
            return (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1;
        } catch (e) { return false; }
    }

    // ---------- 滚动容器：#chat 可滚就用 #chat，不可滚时下探最近的滚动祖先 ----------
    function resolveScroller(doc, w, mes) {
        try {
            var chat = doc.getElementById('chat');
            if (chat && chat.contains(mes) && isScrollable(w, chat)) return chat;
        } catch (e) { /* 继续探测 */ }
        var node = mes.parentElement;
        while (node && node !== doc.body) {
            if (isScrollable(w, node)) return node;
            node = node.parentElement;
        }
        return doc.getElementById('chat') || doc.scrollingElement || doc.body;
    }

    // ---------- 锚定校正：直接设定滚动位置，把楼层顶拉到滚动容器顶部 ----------
    // 用视口矩形差计算目标 scrollTop（矩形差天然包含中间层偏移），并夹在可滚动范围内；
    // 楼层不足一屏、已完全在视口内时也能精确对齐楼顶。
    function computeAnchor(mes, scroller) {
        var sr = scroller.getBoundingClientRect();
        var mr = mes.getBoundingClientRect();
        var anchor = scroller.scrollTop + (mr.top - sr.top);
        var max = scroller.scrollHeight - scroller.clientHeight;
        if (max < 0) max = 0;
        return Math.max(0, Math.min(anchor, max));
    }

    // ---------- 锚定目标钉定：AI 楼层渲染完成时记录楼层号 ----------
    // CHARACTER_MESSAGE_RENDERED 是渲染完成后触发、回调带楼层号的事件；
    // 生成结束时按“最近渲染过的 AI 楼层”锁定目标，重 roll 旧楼层也能对准。
    var pinned = { id: null, at: 0 };
    try {
        if (typeof tavern_events !== 'undefined' && tavern_events.CHARACTER_MESSAGE_RENDERED) {
            eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, function (messageId) {
                pinned.id = (typeof messageId === 'number' && !isNaN(messageId)) ? messageId : null;
                pinned.at = Date.now();
            });
        }
    } catch (e) { /* 缺事件只影响定位精度，退化为按最后一楼锚定 */ }

    // ---------- 锚定会话：持续把楼层顶拉回锚点，用户一动手立即让位 ----------
    var session = null;

    function cancelSession(reason) {
        if (!session) return;
        clearInterval(session.timer);
        session.cleanups.forEach(function (fn) { try { fn(); } catch (e) { /* 忽略 */ } });
        session.fixedScrollers.forEach(function (sc) { try { sc.style.scrollBehavior = ''; } catch (e) { /* 忽略 */ } });
        console.log('[' + SCRIPT_NAME + '] 锚定结束（' + (reason || '完成') + '）');
        session = null;
    }

    function startSession(messageId, durationMs) {
        cancelSession('新会话开始');
        // 目标优先级：显式指定 > 刚渲染过的 AI 楼层 > 最后一楼
        var target = (typeof messageId === 'number' && !isNaN(messageId)) ? messageId
            : (Date.now() - pinned.at < PINNED_WINDOW_MS ? pinned.id : null);
        var hostWin = pickHostWin();
        var st = {
            timer: 0,
            messageId: (typeof target === 'number' && !isNaN(target)) ? target : null,
            until: Date.now() + durationMs,
            startedAt: Date.now(),
            win: hostWin,
            doc: hostWin.document,
            scroller: null,
            fixedScrollers: [],
            hookedFrames: [],
            cleanups: []
        };
        session = st;
        var w = st.win;
        var doc = st.doc;

        // 用户主动滚动 = 立即让位，绝不抢滚动权
        function onGesture() { cancelSession('用户滚动'); }
        function onKeyDown(e) {
            var k = e.key;
            if (k === 'PageUp' || k === 'PageDown' || k === 'Home' || k === 'End' || k === 'ArrowUp' || k === 'ArrowDown') {
                cancelSession('用户键盘滚动');
            }
        }
        function onMouseDown(e) {
            // 仅当按在滚动条所属容器上（拖滚动条）时让位；点消息内按钮不算
            if (e.target === st.scroller) cancelSession('用户拖动滚动条');
        }
        try {
            w.addEventListener('wheel', onGesture, { capture: true, passive: true });
            w.addEventListener('touchstart', onGesture, { capture: true, passive: true });
            w.addEventListener('mousedown', onMouseDown, { capture: true });
            w.addEventListener('keydown', onKeyDown, { capture: true });
            st.cleanups.push(function () {
                w.removeEventListener('wheel', onGesture, { capture: true });
                w.removeEventListener('touchstart', onGesture, { capture: true });
                w.removeEventListener('mousedown', onMouseDown, { capture: true });
                w.removeEventListener('keydown', onKeyDown, { capture: true });
            });
        } catch (e) { /* 监听失败只影响让位灵敏度 */ }

        // 卡片 iframe 占楼层绝大部分面积：让位监听也要挂进 iframe 文档，否则在卡片上滚轮不触发让位
        function hookIframes() {
            var frames = doc.querySelectorAll('.mes iframe');
            Array.prototype.forEach.call(frames, function (fr) {
                if (st.hookedFrames.indexOf(fr) !== -1) return;
                st.hookedFrames.push(fr);
                var frDoc = null;
                try { frDoc = fr.contentDocument; } catch (e) { frDoc = null; }
                if (!frDoc) return;
                try {
                    frDoc.addEventListener('wheel', onGesture, { capture: true, passive: true });
                    frDoc.addEventListener('touchstart', onGesture, { capture: true, passive: true });
                    st.cleanups.push(function () {
                        try { frDoc.removeEventListener('wheel', onGesture, { capture: true }); } catch (e) { /* 忽略 */ }
                        try { frDoc.removeEventListener('touchstart', onGesture, { capture: true }); } catch (e) { /* 忽略 */ }
                    });
                } catch (e) { /* 挂不上就让位灵敏度受限 */ }
            });
        }

        // 楼层内前端界面（美化卡片）渲染完成 → 高度即将定型，追加锚定时长
        // 注意：该事件在 iframe_events 上（官方 event.d.ts）；2.0 误从 tavern_events 取，导致从未生效
        try {
            var renderEnded = null;
            if (typeof iframe_events !== 'undefined' && iframe_events.MESSAGE_IFRAME_RENDER_ENDED) renderEnded = iframe_events.MESSAGE_IFRAME_RENDER_ENDED;
            else if (typeof tavern_events !== 'undefined' && tavern_events.MESSAGE_IFRAME_RENDER_ENDED) renderEnded = tavern_events.MESSAGE_IFRAME_RENDER_ENDED;
            if (renderEnded && typeof eventOn === 'function') {
                var h = eventOn(renderEnded, function () {
                    if (session === st) {
                        st.until = Math.min(st.until + IFRAME_EXTEND_MS, st.startedAt + MAX_WINDOW_MS);
                    }
                });
                st.cleanups.push(function () { try { h.stop(); } catch (e) { /* 忽略 */ } });
            }
        } catch (e) { /* 旧版助手无此事件，靠周期校正兜底 */ }

        // 部分主题给滚动容器配了 smooth 滚动，锚定期强制即时滚动，结束后还原
        function fixScrollBehavior(sc) {
            if (st.fixedScrollers.indexOf(sc) !== -1) return;
            try {
                if (w.getComputedStyle(sc).scrollBehavior !== 'auto') {
                    sc.style.scrollBehavior = 'auto';
                    st.fixedScrollers.push(sc);
                }
            } catch (e) { /* 忽略 */ }
        }

        function tick() {
            if (session !== st) return;
            hookIframes();
            var mes = findFloorElement(doc, st.messageId);
            if (!mes) return; // 楼层尚未上屏（生成结束事件可能早于渲染），窗口内持续重试

            var sc = (st.scroller && st.scroller.contains(mes) && st.scroller.isConnected) ? st.scroller : resolveScroller(doc, w, mes);
            st.scroller = sc;
            fixScrollBehavior(sc);
            var anchor = computeAnchor(mes, sc);
            if (Math.abs(sc.scrollTop - anchor) > 1) {
                sc.scrollTop = anchor; // 即时校正，抵消酒馆自动滚底 / 卡片撑高 / 重排
            }

            if (Date.now() > st.until) { cancelSession('窗口到期'); return; }
        }
        st.timer = setInterval(tick, TICK_MS);
        tick();
        console.log('[' + SCRIPT_NAME + '] 开始锚定楼层顶部（ messageId=' + st.messageId + '，宿主=' + (w === window.top ? 'top' : (w === window.parent ? 'parent' : 'self')) + ' ）');
    }

    // ---------- 全局取消信号：新消息 / 新一轮生成 / 切换聊天 时立即停止锚定 ----------
    try {
        if (typeof tavern_events !== 'undefined') {
            if (tavern_events.MESSAGE_SENT) eventOn(tavern_events.MESSAGE_SENT, function () { cancelSession('新消息发送'); });
            if (tavern_events.GENERATION_STARTED) eventOn(tavern_events.GENERATION_STARTED, function () { cancelSession('新一轮生成'); });
            if (tavern_events.CHAT_CHANGED) eventOn(tavern_events.CHAT_CHANGED, function () { cancelSession('切换聊天'); });
        }
    } catch (e) { /* 缺事件只影响取消灵敏度 */ }

    // 生成结束后：自动模式才回顶。
    // 酒馆核心实际 emit 给 GENERATION_ENDED 的是 chat.length（楼层数），并非楼层号——
    // 助手的 event.d.ts 把它错标成 (message_id: number)，不能拿来当目标；
    // 目标楼层交给 pinned（CHARACTER_MESSAGE_RENDERED）或“最后一楼”解析。
    try {
        if (typeof tavern_events === 'undefined' || !tavern_events.GENERATION_ENDED) throw new Error('tavern_events.GENERATION_ENDED 不可用');
        eventOn(tavern_events.GENERATION_ENDED, function () {
            if (getMode() !== 'auto') {
                console.log('[' + SCRIPT_NAME + '] 生成结束：当前为手动模式，不自动回顶');
                return;
            }
            setTimeout(function () { startSession(undefined, AUTO_WINDOW_MS); }, START_DELAY_MS);
        });
        console.log('[' + SCRIPT_NAME + '] 生成结束事件监听成功');
    } catch (e) {
        console.error('[' + SCRIPT_NAME + '] 事件监听失败', e);
    }

    // ---------- 按钮：单击 = 手动回顶一次（带 2 秒锚定）；400ms 内连点两下 = 切换 自动/手动 ----------
    var lastClick = 0;
    var buttonRetries = 0;
    function bindButton() {
        var handler = function () {
            var now = Date.now();
            if (now - lastClick < 400) {
                lastClick = 0;
                var next = getMode() === 'auto' ? 'manual' : 'auto';
                setMode(next);
                echo(next === 'auto' ? '已切换为自动回顶：生成结束后自动回顶' : '已切换为手动回顶：生成后不自动滚动，点按钮手动回顶');
                return;
            }
            lastClick = now;
            startSession(undefined, MANUAL_WINDOW_MS);
        };
        function tryNewApi() {
            if (typeof getButtonEvent !== 'function' || typeof eventOn !== 'function') return false;
            try {
                eventOn(getButtonEvent('企鹅回顶'), handler);
                console.log('[' + SCRIPT_NAME + '] 按钮注册成功（getButtonEvent），当前模式:', getMode());
                return true;
            } catch (e) { return false; }
        }
        function tryLegacyApi() {
            if (typeof eventOnButton !== 'function') return false;
            try {
                eventOnButton('企鹅回顶', handler);
                console.log('[' + SCRIPT_NAME + '] 按钮注册成功（eventOnButton），当前模式:', getMode());
                return true;
            } catch (e) { return false; }
        }
        function step() {
            if (tryNewApi() || tryLegacyApi()) return;
            if (buttonRetries++ < 10) { setTimeout(step, 500); return; }
            console.error('[' + SCRIPT_NAME + '] 按钮注册失败：getButtonEvent/eventOnButton 均不可用');
        }
        step();
    }
    bindButton();

    // ---------- 启动自检（只写控制台，方便排查环境） ----------
    (function selfCheck() {
        var lines = ['模式=' + getMode()];
        try {
            var w = pickHostWin();
            var chat = w.document.getElementById('chat');
            lines.push('#chat=' + (chat ? (isScrollable(w, chat) ? '可滚动' : '存在但当前不可滚') : '未找到'));
            lines.push('楼层=' + (w.document.querySelector('.mes[mesid]') ? '已渲染' : '未渲染'));
        } catch (e) { lines.push('宿主探测失败'); }
        console.log('[' + SCRIPT_NAME + '] 自检: ' + lines.join('，') + '；单击按钮=手动回顶，400ms内双击=切换自动/手动');
    })();

    // 脚本被停用/编辑导致 iframe 卸载时，停掉锚定
    try {
        window.addEventListener('pagehide', function () { cancelSession('脚本卸载'); }, { once: true });
    } catch (e) { /* 忽略 */ }
})();
