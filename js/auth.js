/*
 * WORLD-SIM — Hệ thống Tài khoản & Lưu game online (Supabase)
 * Copyright © 2026 PHAN HỮU KHÁNH
 *
 * File này CHỈ thêm mới: đăng ký / đăng nhập / đăng xuất bằng Supabase Auth,
 * và tự động lưu/tải trạng thái `game` (từ js/game.js, được export qua
 * window.WorldSim) lên bảng Supabase "game_saves", có RLS để mỗi tài khoản
 * chỉ thấy dữ liệu của chính mình, kèm bản sao lưu localStorage phòng khi
 * mất mạng. Không có dòng nào của gameplay/logic mô phỏng bị thay đổi.
 */
(function(){
    "use strict";

    // ---------------------------------------------------------------------
    // 1) Cấu hình Supabase
    // ---------------------------------------------------------------------
    const SUPABASE_URL = "https://pktgviyfjiqaeyxoczez.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_bMNT3l8UIbQB16UUR7GpcQ_RnqV17wS";
    const SAVE_TABLE = "game_saves";

    if(!window.supabase || !window.WorldSim){
        console.error("[WorldSim/Auth] Thiếu thư viện Supabase hoặc window.WorldSim — kiểm tra thứ tự nạp <script>.");
        return;
    }
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const WS = window.WorldSim; // { game, createWorld, start, stop, update, showScreen, resizeCanvas, drawWorld, closeSettlementModal }

    // ---------------------------------------------------------------------
    // 2) Trạng thái nội bộ của hệ thống lưu game (KHÔNG động vào state game)
    // ---------------------------------------------------------------------
    let currentUser = null;
    let hasActiveWorld = false;   // đã có một thế giới đang chơi (đủ điều kiện autosave) hay chưa
    let authMode = "login";       // "login" | "register"
    let autosaveTimer = null;
    let importantSaveTimer = null;
    let saveInFlight = false;
    let savePendingAfterFlight = false;

    const AUTOSAVE_INTERVAL_MS = 30000;      // autosave định kỳ, không lưu mỗi frame
    const IMPORTANT_SAVE_DEBOUNCE_MS = 1200; // gộp các thay đổi quan trọng xảy ra liên tiếp

    // ---------------------------------------------------------------------
    // 3) DOM refs (màn hình đăng nhập & vùng tài khoản trên topbar)
    // ---------------------------------------------------------------------
    const el = (id)=>document.getElementById(id);
    const authScreen = el("authScreen");
    const authTitle = el("authTitle");
    const authEmailInput = el("authEmailInput");
    const authPasswordInput = el("authPasswordInput");
    const authStatus = el("authStatus");
    const authSubmitButton = el("authSubmitButton");
    const authToggleModeButton = el("authToggleModeButton");
    const logoutButton = el("logoutButton");
    const saveStatusEl = el("saveStatus");

    function setAuthStatus(msg, kind){
        if(!authStatus) return;
        authStatus.textContent = msg || "";
        authStatus.className = "auth-status" + (kind ? " " + kind : "");
    }
    function setSaveStatus(msg){
        if(saveStatusEl) saveStatusEl.textContent = msg || "";
    }
    function showAuthScreen(show){
        if(!authScreen) return;
        authScreen.classList.toggle("hidden", !show);
    }
    function setBusy(busy){
        if(authSubmitButton) authSubmitButton.disabled = busy;
        if(authToggleModeButton) authToggleModeButton.disabled = busy;
    }

    function applyAuthMode(){
        if(authMode === "login"){
            if(authTitle) authTitle.textContent = "Đăng nhập";
            if(authSubmitButton) authSubmitButton.textContent = "ĐĂNG NHẬP";
            if(authToggleModeButton) authToggleModeButton.textContent = "Chưa có tài khoản? Đăng ký ngay";
        } else {
            if(authTitle) authTitle.textContent = "Đăng ký";
            if(authSubmitButton) authSubmitButton.textContent = "ĐĂNG KÝ";
            if(authToggleModeButton) authToggleModeButton.textContent = "Đã có tài khoản? Đăng nhập";
        }
    }
    authToggleModeButton?.addEventListener("click", ()=>{
        authMode = authMode === "login" ? "register" : "login";
        setAuthStatus("");
        applyAuthMode();
    });
    applyAuthMode();

    // ---------------------------------------------------------------------
    // 4) Đăng ký / Đăng nhập / Đăng xuất
    // ---------------------------------------------------------------------
    authSubmitButton?.addEventListener("click", async ()=>{
        const email = (authEmailInput?.value || "").trim();
        const password = authPasswordInput?.value || "";
        if(!email || !password){ setAuthStatus("Vui lòng nhập đầy đủ email và mật khẩu.", "error"); return; }
        if(password.length < 6){ setAuthStatus("Mật khẩu cần tối thiểu 6 ký tự.", "error"); return; }

        setBusy(true);
        setAuthStatus(authMode === "login" ? "Đang đăng nhập..." : "Đang tạo tài khoản...");
        try{
            if(authMode === "login"){
                const { error } = await sb.auth.signInWithPassword({ email, password });
                if(error) throw error;
                // Việc chuyển màn hình được xử lý trong onAuthStateChange (SIGNED_IN)
            } else {
                const { data, error } = await sb.auth.signUp({ email, password });
                if(error) throw error;
                if(data.session){
                    // Dự án đã tắt xác nhận email → có phiên đăng nhập ngay
                    setAuthStatus("Tạo tài khoản thành công!", "ok");
                } else {
                    setAuthStatus("Đã tạo tài khoản. Hãy kiểm tra email để xác nhận, sau đó đăng nhập.", "ok");
                    authMode = "login";
                    applyAuthMode();
                }
            }
        } catch(err){
            setAuthStatus(translateAuthError(err), "error");
        } finally {
            setBusy(false);
        }
    });

    logoutButton?.addEventListener("click", async ()=>{
        logoutButton.disabled = true;
        try{
            if(hasActiveWorld) await saveGameState("logout"); // lưu lần cuối trước khi đăng xuất
        } catch(e){ /* best effort */ }
        await sb.auth.signOut();
        logoutButton.disabled = false;
    });

    function translateAuthError(err){
        const msg = (err && err.message) || "";
        if(/already registered|already exists/i.test(msg)) return "Email này đã được đăng ký. Hãy đăng nhập.";
        if(/invalid login credentials/i.test(msg)) return "Sai email hoặc mật khẩu.";
        if(/rate limit/i.test(msg)) return "Thao tác quá nhanh, vui lòng thử lại sau ít phút.";
        return msg || "Đã có lỗi xảy ra, vui lòng thử lại.";
    }

    // ---------------------------------------------------------------------
    // 5) Lưu / Tải trạng thái game
    // ---------------------------------------------------------------------
    function localKey(userId){ return "worldsim_save_" + userId; }

    // Chụp lại toàn bộ state có thể lưu của `game`. Bỏ qua "timer" (ID của
    // setInterval, vô nghĩa giữa các phiên). JSON round-trip cũng tự động
    // loại bỏ hàm game.isLand (được dựng lại sau khi tải, xem rebuildIsLand).
    function buildSnapshot(game){
        const { timer, ...rest } = game;
        return JSON.parse(JSON.stringify(rest));
    }

    // Dựng lại closure game.isLand(x,y) từ mảng game.terrain.land đã lưu.
    // Hằng số W,H phải khớp với W=64,H=40 trong createTerrain() của game.js.
    function rebuildIsLand(game){
        const W = 64, H = 40;
        const land = game.terrain && game.terrain.land;
        game.isLand = (x, y)=>{
            const gx = Math.floor(x * W), gy = Math.floor(y * H);
            return gx >= 0 && gy >= 0 && gx < W && gy < H && !!(land && land[gy * W + gx]);
        };
    }

    // Trong game.js, game.terrain.resourceNodes được tạo bằng
    // `[...mountains, ...forests]` — TỨC LÀ CÙNG THAM CHIẾU object với các
    // phần tử trong mountains/forests (để khai thác/cạn kiệt mỏ phản ánh
    // đúng lên bản đồ). JSON round-trip khi lưu/tải sẽ làm mất liên kết
    // tham chiếu đó, nên phải dựng lại đúng như createTerrain() từng làm.
    function relinkResourceNodes(game){
        const t = game.terrain;
        if(!t) return;
        t.mountains = t.mountains || [];
        t.forests = t.forests || [];
        t.resourceNodes = [...t.mountains, ...t.forests].filter(n=>!n.exhausted);
    }

    // Gán toàn bộ dữ liệu đã lưu vào ĐÚNG object `game` hiện có (không tạo
    // object mới), vì mọi hàm mô phỏng trong game.js đóng gói tham chiếu tới
    // đúng object này. Không gọi createWorld() — không random lại thế giới.
    function restoreSnapshot(saved){
        const game = WS.game;
        WS.stop();
        Object.keys(game).forEach(k=>{ if(!(k in saved)) delete game[k]; });
        Object.assign(game, saved);
        rebuildIsLand(game);
        relinkResourceNodes(game);
        WS.resizeCanvas();
        WS.update();
        WS.drawWorld();
        WS.start();
        hasActiveWorld = true;
    }

    async function loadSaveForUser(userId){
        try{
            const { data, error } = await sb.from(SAVE_TABLE).select("game_state").eq("user_id", userId).maybeSingle();
            if(error) throw error;
            if(data && data.game_state){
                try{ localStorage.setItem(localKey(userId), JSON.stringify(data.game_state)); }catch(e){}
                return data.game_state;
            }
        } catch(err){
            console.warn("[WorldSim/Auth] Không tải được dữ liệu từ máy chủ, dùng bản sao lưu cục bộ nếu có.", err);
        }
        try{
            const local = localStorage.getItem(localKey(userId));
            if(local) return JSON.parse(local);
        } catch(e){}
        return null;
    }

    async function saveGameState(reason){
        if(!currentUser || !hasActiveWorld) return;
        const snapshot = buildSnapshot(WS.game);
        try{ localStorage.setItem(localKey(currentUser.id), JSON.stringify(snapshot)); }catch(e){}

        if(saveInFlight){ savePendingAfterFlight = true; return; }
        saveInFlight = true;
        try{
            const { error } = await sb.from(SAVE_TABLE).upsert({
                user_id: currentUser.id,
                game_state: snapshot,
                world_name: WS.game.worldName || null,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
            if(error) throw error;
            setSaveStatus("Đã lưu lúc " + new Date().toLocaleTimeString("vi-VN"));
        } catch(err){
            console.warn("[WorldSim/Auth] Lưu online thất bại (đã có bản sao lưu cục bộ).", reason, err);
            setSaveStatus("Mất mạng — đã lưu tạm trên máy này");
        } finally {
            saveInFlight = false;
            if(savePendingAfterFlight){ savePendingAfterFlight = false; saveGameState("retry"); }
        }
    }

    function scheduleImportantSave(){
        clearTimeout(importantSaveTimer);
        importantSaveTimer = setTimeout(()=>saveGameState("event"), IMPORTANT_SAVE_DEBOUNCE_MS);
    }

    function startAutosaveLoop(){
        if(autosaveTimer) clearInterval(autosaveTimer);
        autosaveTimer = setInterval(()=>{
            const gameScreenEl = el("gameScreen");
            if(hasActiveWorld && gameScreenEl && !gameScreenEl.classList.contains("hidden")){
                saveGameState("interval");
            }
        }, AUTOSAVE_INTERVAL_MS);
    }
    function stopAutosaveLoop(){
        if(autosaveTimer){ clearInterval(autosaveTimer); autosaveTimer = null; }
    }

    // ---- Theo dõi các "thay đổi quan trọng" mà KHÔNG sửa game.js: quan sát
    // việc các modal quyết định (chọn làng, lập vương quốc, chiến/hòa, chọn
    // người kế vị, endgame) đóng lại / mở ra, để lưu ngay sau đó. ----
    function observeHideToggle(id, onHidden){
        const node = el(id);
        if(!node) return;
        new MutationObserver((muts)=>{
            for(const m of muts){
                if(m.attributeName === "class" && node.classList.contains("hidden")) onHidden();
            }
        }).observe(node, { attributes: true, attributeFilter: ["class"] });
    }
    function observeShowToggle(id, onShown){
        const node = el(id);
        if(!node) return;
        new MutationObserver((muts)=>{
            for(const m of muts){
                if(m.attributeName === "class" && !node.classList.contains("hidden")) onShown();
            }
        }).observe(node, { attributes: true, attributeFilter: ["class"] });
    }
    ["villageChoiceModal", "kingdomChoiceModal", "warProposalModal", "heirChoiceModal"]
        .forEach(id=>observeHideToggle(id, scheduleImportantSave));
    // Một thế giới mới vừa được tạo (nút "BẮT ĐẦU THẾ GIỚI") → lưu ngay lần đầu.
    observeShowToggle("gameScreen", ()=>{ hasActiveWorld = true; scheduleImportantSave(); });
    // Vương quốc người chơi sụp đổ → lưu lại trạng thái cuối, dừng autosave định kỳ.
    observeShowToggle("endgameScreen", ()=>{ scheduleImportantSave(); hasActiveWorld = false; });

    document.addEventListener("visibilitychange", ()=>{
        if(document.hidden && hasActiveWorld) saveGameState("visibilitychange");
    });
    window.addEventListener("beforeunload", ()=>{
        // Cố gắng lưu tối thiểu bản sao lưu cục bộ trước khi rời trang (đồng bộ, không phụ thuộc mạng).
        if(currentUser && hasActiveWorld){
            try{ localStorage.setItem(localKey(currentUser.id), JSON.stringify(buildSnapshot(WS.game))); }catch(e){}
        }
    });

    // ---------------------------------------------------------------------
    // 6) Vòng đời phiên đăng nhập
    // ---------------------------------------------------------------------
    async function afterSignedIn(user){
        currentUser = user;
        showAuthScreen(false);
        setSaveStatus("Đang tải tiến trình...");
        const saved = await loadSaveForUser(user.id);
        if(saved && saved.settlements){
            restoreSnapshot(saved);
            WS.showScreen("gameScreen");
            setSaveStatus("Đã tải tiến trình đã lưu.");
        } else {
            hasActiveWorld = false;
            setSaveStatus("");
            WS.showScreen("introScreen");
        }
        startAutosaveLoop();
    }

    function resetToSignedOut(){
        currentUser = null;
        hasActiveWorld = false;
        stopAutosaveLoop();
        WS.stop();
        ["introScreen", "setupScreen", "gameScreen", "endgameScreen"].forEach(id=>el(id)?.classList.add("hidden"));
        setSaveStatus("");
        setAuthStatus("");
        if(authEmailInput) authEmailInput.value = "";
        if(authPasswordInput) authPasswordInput.value = "";
        showAuthScreen(true);
    }

    let handledInitialSession = false;
    sb.auth.onAuthStateChange((event, session)=>{
        if(event === "SIGNED_IN" || event === "INITIAL_SESSION"){
            if(session && session.user){
                if(!currentUser || currentUser.id !== session.user.id){
                    afterSignedIn(session.user);
                }
            } else if(event === "INITIAL_SESSION" && !handledInitialSession){
                showAuthScreen(true);
            }
            handledInitialSession = true;
        } else if(event === "SIGNED_OUT"){
            handledInitialSession = true;
            resetToSignedOut();
        }
    });
})();
