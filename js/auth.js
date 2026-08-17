/*
 * WORLD-SIM — Hệ thống Tài khoản & Lưu game online (Supabase)
 * Copyright © 2026 PHAN HỮU KHÁNH
 *
 * File này CHỈ thêm mới: đăng ký / đăng nhập / đăng xuất bằng Supabase Auth,
 * quản lý NHIỀU thế giới cho mỗi tài khoản (đồng bộ trên mọi thiết bị qua
 * bảng Supabase "game_saves" — mỗi thế giới là MỘT DÒNG riêng, khóa chính
 * là "id"), và tự động lưu/tải trạng thái `game` (từ js/game.js, được
 * export qua window.WorldSim) lên/xuống dòng tương ứng, kèm bản sao lưu
 * localStorage phòng khi mất mạng. Không có dòng nào của gameplay/logic
 * mô phỏng trong js/game.js bị thay đổi.
 *
 * QUAN TRỌNG — CẤU HÌNH SUPABASE CẦN THIẾT (chạy 1 lần trong SQL Editor):
 * Bảng "game_saves" phải hỗ trợ NHIỀU dòng cho mỗi user_id (một dòng =
 * một thế giới), có cột id (uuid, khóa chính), user_id, world_name,
 * game_year, game_state (jsonb), created_at, updated_at — cùng RLS để
 * mỗi tài khoản chỉ thấy/thao tác được thế giới của chính mình. Xem file
 * "supabase_migration.sql" đi kèm để chạy migration này.
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
    let currentWorldId = null;    // id (uuid) của dòng Supabase ứng với thế giới đang chơi; null = chưa từng lưu lên máy chủ
    let hasActiveWorld = false;   // đã có một thế giới đang chơi (đủ điều kiện autosave) hay chưa
    let authMode = "login";       // "login" | "register"
    let autosaveTimer = null;
    let importantSaveTimer = null;
    let saveInFlight = false;
    let savePendingAfterFlight = false;

    const AUTOSAVE_INTERVAL_MS = 30000;      // autosave định kỳ, không lưu mỗi frame
    const IMPORTANT_SAVE_DEBOUNCE_MS = 1200; // gộp các thay đổi quan trọng xảy ra liên tiếp

    // ---------------------------------------------------------------------
    // 3) DOM refs
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

    const worldListScreen = el("worldListScreen");
    const worldListStatus = el("worldListStatus");
    const worldListItems = el("worldListItems");
    const newWorldFromListButton = el("newWorldFromListButton");
    const worldListLogoutButton = el("worldListLogoutButton");
    const switchWorldButton = el("switchWorldButton");

    function setAuthStatus(msg, kind){
        if(!authStatus) return;
        authStatus.textContent = msg || "";
        authStatus.className = "auth-status" + (kind ? " " + kind : "");
    }
    function setSaveStatus(msg){
        if(saveStatusEl) saveStatusEl.textContent = msg || "";
    }
    function setWorldListStatus(msg, kind){
        if(!worldListStatus) return;
        worldListStatus.textContent = msg || "";
        worldListStatus.className = "auth-status" + (kind ? " " + kind : "");
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

    async function doLogout(){
        try{
            if(hasActiveWorld) await saveGameState("logout"); // lưu lần cuối trước khi đăng xuất
        } catch(e){ /* best effort */ }
        await sb.auth.signOut();
    }
    logoutButton?.addEventListener("click", async ()=>{
        logoutButton.disabled = true;
        await doLogout();
        logoutButton.disabled = false;
    });
    worldListLogoutButton?.addEventListener("click", async ()=>{
        worldListLogoutButton.disabled = true;
        await doLogout();
        worldListLogoutButton.disabled = false;
    });

    function translateAuthError(err){
        const msg = (err && err.message) || "";
        if(/already registered|already exists/i.test(msg)) return "Email này đã được đăng ký. Hãy đăng nhập.";
        if(/invalid login credentials/i.test(msg)) return "Sai email hoặc mật khẩu.";
        if(/rate limit/i.test(msg)) return "Thao tác quá nhanh, vui lòng thử lại sau ít phút.";
        return msg || "Đã có lỗi xảy ra, vui lòng thử lại.";
    }

    // ---------------------------------------------------------------------
    // 5) Lưu / Tải trạng thái game (nhiều thế giới / tài khoản)
    // ---------------------------------------------------------------------
    // Khóa sao lưu cục bộ theo TỪNG thế giới (worldId = null → thế giới mới
    // chưa từng được cấp id từ máy chủ, dùng khóa tạm "pending").
    function localKey(userId, worldId){ return "worldsim_save_" + userId + "_" + (worldId || "pending"); }

    function escapeHtml(s){
        return String(s==null?"":s).replace(/[&<>"']/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
    }
    function formatUpdatedAt(iso){
        try{ return new Date(iso).toLocaleString("vi-VN"); } catch(e){ return ""; }
    }

    // Chụp lại toàn bộ state có thể lưu của `game`. Bỏ qua "timer" (ID của
    // setInterval, vô nghĩa giữa các phiên). JSON round-trip cũng tự động
    // loại bỏ hàm game.isLand (được dựng lại sau khi tải, xem rebuildIsLand).
    // Lưu ý: game.weather / game.clouds / game.rainDrops (dữ liệu hiệu ứng
    // thời tiết) đều là thuộc tính thường của `game` nên tự động được lưu
    // và khôi phục cùng toàn bộ thế giới — không cần xử lý riêng.
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
        // (V8.0) Quyền năng thế giới: các thế giới lưu TRƯỚC khi có tính năng này sẽ
        // không có game.powers trong dữ liệu đã lưu (saved) → bị xóa ở vòng lặp phía
        // trên → ensurePowersState() sẽ khởi tạo lại mặc định (0 XU, chỉ Sấm Sét mở
        // sẵn). Với thế giới đã có game.powers, hàm này chỉ chuẩn hóa/bù các khóa còn thiếu.
        WS.ensurePowersState && WS.ensurePowersState();
        WS.renderPowersPanel && WS.renderPowersPanel();
        WS.resizeCanvas();
        WS.update();
        WS.drawWorld();
        WS.start();
        hasActiveWorld = true;
    }

    // Danh sách các thế giới của tài khoản hiện tại (KHÔNG kéo theo
    // game_state đầy đủ — chỉ những gì cần để hiển thị danh sách, để nhẹ
    // và nhanh dù có nhiều thế giới).
    async function fetchWorldList(userId){
        const { data, error } = await sb.from(SAVE_TABLE)
            .select("id, world_name, game_year, updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false });
        if(error) throw error;
        return data || [];
    }

    async function loadWorldById(id){
        try{
            const { data, error } = await sb.from(SAVE_TABLE).select("game_state").eq("id", id).eq("user_id", currentUser.id).maybeSingle();
            if(error) throw error;
            if(data && data.game_state){
                try{ localStorage.setItem(localKey(currentUser.id, id), JSON.stringify(data.game_state)); }catch(e){}
                return data.game_state;
            }
        } catch(err){
            console.warn("[WorldSim/Auth] Không tải được thế giới từ máy chủ, dùng bản sao lưu cục bộ nếu có.", err);
        }
        try{
            const local = localStorage.getItem(localKey(currentUser.id, id));
            if(local) return JSON.parse(local);
        } catch(e){}
        return null;
    }

    async function saveGameState(reason){
        if(!currentUser || !hasActiveWorld) return;
        const snapshot = buildSnapshot(WS.game);
        try{ localStorage.setItem(localKey(currentUser.id, currentWorldId), JSON.stringify(snapshot)); }catch(e){}

        if(saveInFlight){ savePendingAfterFlight = true; return; }
        saveInFlight = true;
        try{
            const row = {
                user_id: currentUser.id,
                game_state: snapshot,
                world_name: WS.game.worldName || null,
                game_year: WS.game.year || 1,
                updated_at: new Date().toISOString()
            };
            if(currentWorldId){
                // Thế giới đã tồn tại trên máy chủ → cập nhật đúng dòng của nó.
                const { error } = await sb.from(SAVE_TABLE).update(row).eq("id", currentWorldId).eq("user_id", currentUser.id);
                if(error) throw error;
            } else {
                // Thế giới mới, lần lưu đầu tiên → tạo dòng mới và ghi nhớ id được cấp,
                // để các lần lưu sau CẬP NHẬT đúng dòng này thay vì tạo thêm thế giới mới.
                const { data, error } = await sb.from(SAVE_TABLE).insert(row).select("id").single();
                if(error) throw error;
                if(data && data.id){
                    try{
                        const pending = localStorage.getItem(localKey(currentUser.id, null));
                        if(pending) localStorage.setItem(localKey(currentUser.id, data.id), pending);
                        localStorage.removeItem(localKey(currentUser.id, null));
                    }catch(e){}
                    currentWorldId = data.id;
                }
            }
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
    // (V8.0) Hệ thống Quyền năng thế giới: game.js phát sự kiện này mỗi khi XU,
    // quyền năng đã mở khóa, hoặc cooldown Sấm Sét thay đổi — lưu ngay (debounce
    // 1.2s) để cooldown/XU không bị mất khi F5, đăng xuất, hoặc chuyển thiết bị.
    window.addEventListener("worldsim:power-changed", ()=>{ if(hasActiveWorld) scheduleImportantSave(); });
    // Một thế giới mới vừa được tạo (nút "BẮT ĐẦU THẾ GIỚI") → lưu ngay lần đầu
    // (currentWorldId đang null vào lúc này nên sẽ tạo một dòng MỚI, không đè lên thế giới khác).
    observeShowToggle("gameScreen", ()=>{ hasActiveWorld = true; scheduleImportantSave(); });
    // Vương quốc người chơi sụp đổ → lưu lại trạng thái cuối NGAY (không debounce, vì
    // hasActiveWorld sẽ bị tắt ngay sau đó khiến lần lưu debounce phía sau bị bỏ qua),
    // rồi mới dừng autosave định kỳ.
    observeShowToggle("endgameScreen", ()=>{
        if(hasActiveWorld){
            saveGameState("endgame").catch(()=>{}).finally(()=>{ hasActiveWorld = false; });
        } else {
            hasActiveWorld = false;
        }
    });
    // Người chơi bấm "VỀ TRANG TẠO THẾ GIỚI" sau khi vương quốc sụp đổ → thế giới tiếp theo
    // là một thế giới HOÀN TOÀN MỚI, không được ghi đè lên thế giới vừa sụp đổ.
    el("endgameRestartButton")?.addEventListener("click", ()=>{
        currentWorldId = null;
        hasActiveWorld = false;
    });

    document.addEventListener("visibilitychange", ()=>{
        if(document.hidden && hasActiveWorld) saveGameState("visibilitychange");
    });
    window.addEventListener("beforeunload", ()=>{
        // Cố gắng lưu tối thiểu bản sao lưu cục bộ trước khi rời trang (đồng bộ, không phụ thuộc mạng).
        if(currentUser && hasActiveWorld){
            try{ localStorage.setItem(localKey(currentUser.id, currentWorldId), JSON.stringify(buildSnapshot(WS.game))); }catch(e){}
        }
    });

    // ---------------------------------------------------------------------
    // 6) Màn hình DANH SÁCH THẾ GIỚI (đồng bộ theo tài khoản qua Supabase)
    // ---------------------------------------------------------------------
    function hideOtherTopScreens(){
        ["introScreen", "setupScreen", "gameScreen", "endgameScreen"].forEach(id=>el(id)?.classList.add("hidden"));
    }
    function showWorldListScreen(){
        showAuthScreen(false);
        hideOtherTopScreens();
        worldListScreen?.classList.remove("hidden");
    }
    function hideWorldListScreen(){
        worldListScreen?.classList.add("hidden");
    }

    function renderWorldList(worlds){
        if(!worldListItems) return;
        if(!worlds.length){
            worldListItems.innerHTML = `<div class="world-list-empty">Anh chưa có thế giới nào. Hãy tạo thế giới đầu tiên của mình!</div>`;
            return;
        }
        worldListItems.innerHTML = worlds.map(w=>`
            <div class="world-item">
                <div class="world-item-info">
                    <div class="world-item-name">${escapeHtml(w.world_name || "Thế giới")}</div>
                    <div class="world-item-meta">Năm ${escapeHtml(w.game_year || 1)} · Cập nhật ${escapeHtml(formatUpdatedAt(w.updated_at))}</div>
                </div>
                <div class="world-item-actions">
                    <button type="button" class="world-continue-btn" data-id="${escapeHtml(w.id)}">TIẾP TỤC</button>
                    <button type="button" class="world-delete-btn" data-id="${escapeHtml(w.id)}" title="Xóa thế giới này">✕</button>
                </div>
            </div>
        `).join("");
    }

    async function openWorldListScreen(){
        setWorldListStatus("Đang tải danh sách thế giới...");
        showWorldListScreen();
        try{
            const worlds = await fetchWorldList(currentUser.id);
            renderWorldList(worlds);
            setWorldListStatus("");
            return worlds;
        } catch(err){
            console.warn("[WorldSim/Auth] Không tải được danh sách thế giới từ máy chủ.", err);
            renderWorldList([]);
            setWorldListStatus("Không tải được danh sách từ máy chủ. Kiểm tra kết nối mạng rồi thử lại.", "error");
            return [];
        }
    }

    async function continueWorld(id){
        if(!currentUser || !id) return;
        setWorldListStatus("Đang tải thế giới...");
        try{
            const saved = await loadWorldById(id);
            if(!saved || !saved.settlements) throw new Error("Không tìm thấy dữ liệu của thế giới này.");
            currentWorldId = id;
            hideWorldListScreen();
            WS.showScreen("gameScreen");
            restoreSnapshot(saved);
            setSaveStatus("Đã tải tiến trình đã lưu.");
        } catch(err){
            setWorldListStatus("Không tải được thế giới này. " + ((err && err.message) || ""), "error");
        }
    }

    async function handleDeleteWorld(id){
        if(!currentUser || !id) return;
        const ok = window.confirm("Xóa vĩnh viễn thế giới này? Hành động này không thể hoàn tác.");
        if(!ok) return;
        setWorldListStatus("Đang xóa thế giới...");
        try{
            const { error } = await sb.from(SAVE_TABLE).delete().eq("id", id).eq("user_id", currentUser.id);
            if(error) throw error;
            try{ localStorage.removeItem(localKey(currentUser.id, id)); }catch(e){}
            if(currentWorldId === id){ currentWorldId = null; hasActiveWorld = false; }
            await openWorldListScreen();
        } catch(err){
            setWorldListStatus("Không xóa được thế giới này. " + ((err && err.message) || ""), "error");
        }
    }

    worldListItems?.addEventListener("click", (e)=>{
        const contBtn = e.target.closest(".world-continue-btn");
        const delBtn = e.target.closest(".world-delete-btn");
        if(contBtn) continueWorld(contBtn.dataset.id);
        else if(delBtn) handleDeleteWorld(delBtn.dataset.id);
    });

    newWorldFromListButton?.addEventListener("click", ()=>{
        currentWorldId = null;
        hasActiveWorld = false;
        hideWorldListScreen();
        WS.showScreen("introScreen");
    });

    // Nút trên topbar trong lúc chơi: lưu tiến trình hiện tại rồi quay về
    // danh sách thế giới để chọn/chuyển sang thế giới khác (không cần đăng xuất).
    switchWorldButton?.addEventListener("click", async ()=>{
        if(!currentUser) return;
        switchWorldButton.disabled = true;
        try{
            if(hasActiveWorld) await saveGameState("switch-world");
            WS.stop();
            hasActiveWorld = false;
            await openWorldListScreen();
        } finally {
            switchWorldButton.disabled = false;
        }
    });

    // ---------------------------------------------------------------------
    // 7) Vòng đời phiên đăng nhập
    // ---------------------------------------------------------------------
    async function afterSignedIn(user){
        currentUser = user;
        currentWorldId = null;
        hasActiveWorld = false;
        showAuthScreen(false);
        // Yêu cầu: sau khi đăng nhập luôn hiện màn hình DANH SÁCH THẾ GIỚI,
        // được tải trực tiếp từ Supabase (không phụ thuộc localStorage) —
        // để mọi thiết bị đăng nhập cùng tài khoản đều thấy đúng danh sách.
        await openWorldListScreen();
        startAutosaveLoop();
    }

    function resetToSignedOut(){
        currentUser = null;
        currentWorldId = null;
        hasActiveWorld = false;
        stopAutosaveLoop();
        WS.stop();
        ["introScreen", "setupScreen", "gameScreen", "endgameScreen", "worldListScreen"].forEach(id=>el(id)?.classList.add("hidden"));
        setSaveStatus("");
        setAuthStatus("");
        setWorldListStatus("");
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
