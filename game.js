// デバッグ用のログ出力設定（通常はfalseにしておきます）
const DEBUG_MODE = false;
function log(message, ...args) {
    if (DEBUG_MODE) {
        const time = new Date().toLocaleTimeString();
        console.log(`[${time}] ${message}`, ...args);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    log("DOMコンテンツの読み込み完了");

    // --- モジュールエイリアス ---
    const { Engine, Render, Runner, Bodies, Composite, World, Events, Mouse, MouseConstraint, Constraint } = Matter;

    // --- DOM要素の取得 ---
    const dom = {
        titleScreen: document.getElementById('title-screen'),
        storyModeButton: document.getElementById('story-mode-button'),
        endlessModeButton: document.getElementById('endless-mode-button'),
        collectionButton: document.getElementById('collection-button'),
        
        gameMainScreen: document.getElementById('game-main-screen'),
        gameContainer: document.getElementById('game-container'),
        salaryValue: document.getElementById('salary-value'),
        approveList: document.getElementById('approve-list'),
        deleteList: document.getElementById('delete-list'),
        comboDisplay: document.getElementById('combo-display'),
        comboCount: document.getElementById('combo-count'),
        controlReverseIndicator: document.getElementById('control-reverse-indicator'),

        stageInfoOverlay: document.getElementById('stage-info-overlay'),
        stageTitle: document.getElementById('stage-title'),
        stageScenario: document.getElementById('stage-scenario'),
        stageClearCondition: document.getElementById('stage-clear-condition'),
        stageStartButton: document.getElementById('stage-start-button'),

        stageClearOverlay: document.getElementById('stage-clear-overlay'),
        clearScenario: document.getElementById('clear-scenario'),
        debugReputation: document.getElementById('debug-reputation'),
        nextStageButton: document.getElementById('next-stage-button'),

        gameoverScreen: document.getElementById('gameover-screen'),
        finalSalary: document.getElementById('final-salary'),
        restartButton: document.getElementById('restart-button'),

        endingScreen: document.getElementById('ending-screen'),
        endingTitle: document.getElementById('ending-title'),
        endingScenario: document.getElementById('ending-scenario'),
        backToTitleButton: document.getElementById('back-to-title-button'),
        
        collectionScreen: document.getElementById('collection-screen'),
        collectionBackButton: document.getElementById('collection-back-button'),
        achievementsList: document.getElementById('achievements-list'),
        recordsList: document.getElementById('records-list'),
        
        achievementToast: document.getElementById('achievement-toast'),
        toastText: document.getElementById('toast-text')
    };

    // --- サウンドの準備 ---
    const sounds = {
        bgm: new Audio('sounds/bgm.mp3'),
        correct: new Audio('sounds/correct.wav'),
        combo: new Audio('sounds/combo.wav'),
        miss: new Audio('sounds/miss.wav'),
        gameover: new Audio('sounds/gameover.wav')
    };
    sounds.bgm.loop = true;
    sounds.bgm.volume = 0.3;

    // --- 定数定義 ---
    const CONSTANTS = {
        DEAD_LINE_Y_RATIO: 0.25,
        FLICK_VELOCITY_THRESHOLD: 5,
        BLOCK_SPAWN_INTERVAL: 2000,
        RULE_ADD_INTERVAL: 15000,
        CONTROL_REVERSE_DURATION: 5000,
        MALWARE_LIFETIME: 10000,
        VIP_TIME_LIMIT: 8000,
        SALARY_CORRECT_BASE: 100,
        SALARY_MISS_PENALTY: 50,
        SALARY_MALWARE_PENALTY: 150,
        SALARY_VIP_BONUS: 200, 
        SALARY_HIDDEN_BONUS: 150,
        SALARY_GROUP_PER_BLOCK: 150,
        REP_SINCERITY_NORMAL: 1,
        REP_COLDNESS_VIP: 2,
        REP_COLDNESS_HIDDEN: 1,
        REP_CUNNING_BRIBE: 3,
        REP_SINCERITY_GROUP_PER_BLOCK: 1,
        REP_SINCERITY_BRIBE_REFUSE: 1,
    };

    const ATTRIBUTES = {
        urgent: { icon: '🔥', text: '緊急', color: '#ff7675' },
        important: { icon: '⭐', text: '重要', color: '#fdcb6e' },
        caution: { icon: '⚠️', text: '要注意', color: '#a29bfe' }
    };

    let RULE_POOL = [];

    const ACHIEVEMENTS = {
        first_job: { title: "初仕事", desc: "最初の給料を受け取る" },
        combo_10: { title: "コンボビギナー", desc: "10コンボを達成する" },
        combo_50: { title: "コンボマスター", desc: "50コンボを達成する" },
        vip_handle: { title: "VIP対応", desc: "初めてVIPブロックを処理する" },
        hidden_solve: { title: "慧眼", desc: "初めて隠蔽ブロックを処理する" },
        group_clear: { title: "チームワーク", desc: "初めて連結ブロックをクリアする" },
        malware_avoid: { title: "危機回避", desc: "妨害ブロックを無事にやり過ごす" },
        cunning_choice: { title: "裏取引", desc: "初めて賄賂ブロックを受け取る" },
        sincerity_end: { title: "市民の英雄", desc: "誠実エンディングに到達する" },
        coldness_end: { title: "組織の頂点", desc: "冷徹エンディングに到達する" },
        cunning_end: { title: "富と破滅", desc: "狡猾エンディングに到達する" },
        normal_end: { title: "平凡なオペレーター", desc: "通常エンディングに到達する" }
    };

    const RECORDS = {
        vip: { text: "VIP客 (👑)" },
        hidden: { text: "隠蔽ブロック (❓)" },
        group: { text: "グループ客 (🔗)" },
        malware: { text: "妨害ブロック (!)" },
        bribe: { text: "賄賂ブロック (💰)" },
        urgent: { text: "緊急属性 (🔥)" },
        important: { text: "重要属性 (⭐)" },
        caution: { text: "要注意属性 (⚠️)" }
    };

    // --- ゲーム状態管理 ---
    let engine, world, render, runner, mouseConstraint;
    let salary, combo, reputation;
    let blockSpawnerTimerId, ruleAddTimerId, controlReverseTimerId;
    let groupCounter, processedGroups;
    let storyData = [], endingData = {};
    let currentStageIndex, gameMode, currentClearCondition, activeRules;
    let isControlReversed;
    let isGameOver;
    let rulesMap = new Map();

    // --- プレイヤーデータ ---
    let playerData = {
        unlockedAchievements: new Set(),
        unlockedRecords: new Set()
    };
    
    // =============================================
    // ★★★ データ管理関数 ★★★
    // =============================================
    
    function loadPlayerData() {
        try {
            const savedData = localStorage.getItem('reserve_delete_playerData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                playerData.unlockedAchievements = new Set(parsedData.unlockedAchievements || []);
                playerData.unlockedRecords = new Set(parsedData.unlockedRecords || []);
            }
        } catch (error) {
            console.error("プレイヤーデータのロードに失敗しました:", error);
            playerData = { unlockedAchievements: new Set(), unlockedRecords: new Set() };
        }
    }
    
    function savePlayerData() {
        const dataToSave = {
            unlockedAchievements: Array.from(playerData.unlockedAchievements),
            unlockedRecords: Array.from(playerData.unlockedRecords)
        };
        localStorage.setItem('reserve_delete_playerData', JSON.stringify(dataToSave));
    }

    async function loadGameData() {
        try {
            const [rulesResponse, storyResponse, endingResponse] = await Promise.all([
                fetch('rules.json'),
                fetch('story.json'),
                fetch('endings.json')
            ]);

            if (!rulesResponse.ok || !storyResponse.ok || !endingResponse.ok) {
                throw new Error(`ファイル読み込みエラー: rules:${rulesResponse.status}, story:${storyResponse.status}, ending:${endingResponse.status}`);
            }

            const rawRulesData = await rulesResponse.json();
            // --- ▼▼▼【修正点1】 'await await' という致命的な構文エラーを修正 ▼▼▼ ---
            const rawStoryData = await storyResponse.json();
            endingData = await endingResponse.json();

            RULE_POOL = rawRulesData.map(rule => ({ ...rule, condition: new Function('b', `return ${rule.condition}`) }));
            RULE_POOL.forEach(rule => rulesMap.set(rule.id, rule));

            storyData = rawStoryData.map(stage => ({
                ...stage,
                rules: stage.rules.map(stageRule => {
                    if (!stageRule || typeof stageRule.id === 'undefined') {
                        console.warn("WARN: story.jsonに不正なルール定義あり", stageRule);
                        return { type: 'delete', text: '不正なルール', icon: '❓', condition: () => true };
                    }
                    const ruleFromPool = rulesMap.get(stageRule.id);
                    if (ruleFromPool) {
                        return { ...ruleFromPool };
                    } else {
                        console.warn(`WARN: ルールID '${stageRule.id}' が見つかりません`);
                        return { type: 'delete', text: '不明なルール', icon: '❓', condition: () => true };
                    }
                })
            }));
        } catch (error) {
            console.error("ゲームデータの読み込みに失敗しました:", error);
            alert("ゲームデータの読み込みに失敗しました。ファイルが存在するか、JSONの形式が正しいか確認してください。");
            storyData = [];
            endingData = { normal_end: { title: "エラー", scenario: ["データ読み込み失敗"] } };
        }
    }
    
    // =============================================
    // ★★★ UI/画面遷移関数 ★★★
    // =============================================

    function showTitleScreen() {
        log("UI: タイトル画面表示");
        dom.gameMainScreen.style.display = 'none';
        dom.stageInfoOverlay.style.display = 'none';
        dom.stageClearOverlay.style.display = 'none';
        dom.gameoverScreen.style.display = 'none';
        dom.endingScreen.style.display = 'none';
        dom.collectionScreen.style.display = 'none';
        dom.titleScreen.style.display = 'flex';
        
        sounds.bgm.pause();
        if(sounds.bgm.currentTime > 0) sounds.bgm.currentTime = 0;
        cleanupMatterEngine();
    }
    
    function showGameScreen() {
        log("UI: ゲーム画面表示");
        dom.titleScreen.style.display = 'none';
        dom.stageInfoOverlay.style.display = 'none';
        dom.gameMainScreen.style.display = 'block';
        gameStart();
    }

    function showStageInfo(stageIndex) {
        log(`UI: ステージ情報表示 (Index: ${stageIndex})`);
        if (stageIndex >= storyData.length) {
            showEnding();
            return;
        }

        currentStageIndex = stageIndex;
        const stage = storyData[stageIndex];
        
        if (!stage) {
            console.error(`ステージデータ[${stageIndex}]が見つかりません。`);
            alert(`ステージ${stageIndex + 1}のデータを読み込めませんでした。`);
            showTitleScreen();
            return;
        }

        dom.stageTitle.textContent = stage.title;
        dom.stageScenario.innerHTML = stage.scenario_pre.map(p => `<p>${p}</p>`).join('');
        if (stage.clear_condition.type === 'salary') {
            dom.stageClearCondition.textContent = `給料が ￥${stage.clear_condition.value} に到達する`;
        }

        dom.titleScreen.style.display = 'none';
        dom.stageInfoOverlay.style.display = 'flex';
    }

    function showEnding() {
        log("UI: エンディング表示");
        const { sincerity, coldness, cunning } = reputation;
        let finalEnding = endingData.normal_end;
        let end_id = 'normal_end';

        if (sincerity > coldness * 1.5 && sincerity > cunning * 1.5 && sincerity > 10) {
            finalEnding = endingData.sincerity_end;
            end_id = 'sincerity_end';
        } else if (coldness > sincerity * 1.5 && coldness > cunning * 1.5 && coldness > 10) {
            finalEnding = endingData.coldness_end;
            end_id = 'coldness_end';
        } else if (cunning > sincerity && cunning > coldness && cunning > 8) {
            finalEnding = endingData.cunning_end;
            end_id = 'cunning_end';
        }
        
        unlockAchievement(end_id);

        dom.endingTitle.textContent = finalEnding.title;
        dom.endingScenario.innerHTML = finalEnding.scenario.map(p => `<p>${p}</p>`).join('');
        
        dom.gameMainScreen.style.display = 'none';
        dom.endingScreen.style.display = 'flex';
        cleanupMatterEngine();
    }

    function updateCollectionView() {
        dom.achievementsList.innerHTML = '';
        for (const id in ACHIEVEMENTS) {
            const ach = ACHIEVEMENTS[id];
            const li = document.createElement('li');
            li.className = playerData.unlockedAchievements.has(id) ? 'unlocked' : '';
            li.innerHTML = playerData.unlockedAchievements.has(id) ? `${ach.title} <span class="desc">- ${ach.desc}</span>` : `??? <span class="desc">- ${ach.desc}</span>`;
            dom.achievementsList.appendChild(li);
        }

        dom.recordsList.innerHTML = '';
        for (const id in RECORDS) {
            const rec = RECORDS[id];
            const li = document.createElement('li');
            li.className = playerData.unlockedRecords.has(id) ? 'unlocked' : '';
            li.textContent = playerData.unlockedRecords.has(id) ? rec.text : '???';
            dom.recordsList.appendChild(li);
        }
    }

    function showAchievementToast(title) {
        dom.toastText.textContent = `実績解除: ${title}`;
        dom.achievementToast.style.bottom = '20px';
        setTimeout(() => { dom.achievementToast.style.bottom = '-100px'; }, 3000);
    }
    
    // =============================================
    // ★★★ ゲームロジック関数 ★★★
    // =============================================

    function cleanupMatterEngine() {
        if (blockSpawnerTimerId) clearInterval(blockSpawnerTimerId);
        if (ruleAddTimerId) clearInterval(ruleAddTimerId);
        if (controlReverseTimerId) clearTimeout(controlReverseTimerId);

        if (runner) Runner.stop(runner);
        if (render && render.canvas) {
            Render.stop(render);
            render.canvas.remove();
        }
        if (engine) Engine.clear(engine);
        
        blockSpawnerTimerId = null;
        ruleAddTimerId = null;
        controlReverseTimerId = null;
        runner = null;
        render = null;
        engine = null;
        world = null;
        mouseConstraint = null;
    }

    function gameStart() {
        log("GAME: ゲーム初期化・開始");
        cleanupMatterEngine();

        isGameOver = false;
        salary = 0;
        combo = 0;
        reputation = { sincerity: 0, coldness: 0, cunning: 0 };
        groupCounter = 0;
        processedGroups = {};
        isControlReversed = false;
        dom.controlReverseIndicator.classList.remove('active');
        
        updateSalaryDisplay();
        updateComboDisplay();
        
        sounds.bgm.play().catch(e => log("BGM再生にはユーザー操作が必要です:", e));

        engine = Engine.create({ enableSleeping: true });
        world = engine.world;
        world.gravity.y = 1.0; // 重力設定
        render = Render.create({
            element: dom.gameContainer,
            engine: engine,
            options: { width: window.innerWidth, height: window.innerHeight, wireframes: false, background: 'transparent' }
        });
        
        dom.gameContainer.innerHTML = '';
        dom.gameContainer.appendChild(render.canvas);
        
        runner = Runner.create();
        
        const floorOptions = { isStatic: true, render: { fillStyle: '#636e72' } };
        const wallOptions = { isStatic: true, render: { visible: false } };
        Composite.add(world, [
            Bodies.rectangle(window.innerWidth / 2, window.innerHeight - 10, window.innerWidth, 20, floorOptions),
            Bodies.rectangle(-30, window.innerHeight / 2, 60, window.innerHeight, wallOptions),
            Bodies.rectangle(window.innerWidth + 30, window.innerHeight / 2, 60, window.innerHeight, wallOptions)
        ]);

        mouseConstraint = MouseConstraint.create(engine, {
            mouse: Mouse.create(render.canvas),
            constraint: { stiffness: 0.2, render: { visible: false } }
        });
        Composite.add(world, mouseConstraint);

        if (gameMode === 'story') {
            const stage = storyData[currentStageIndex];
            activeRules = stage.rules;
            currentClearCondition = stage.clear_condition;
        } else { 
            activeRules = [];
            addNewRule();
            ruleAddTimerId = setInterval(addNewRule, CONSTANTS.RULE_ADD_INTERVAL);
        }
        
        updateRuleDisplay(); 

        setupGameEventListeners();
        Render.run(render);
        Runner.run(runner, engine);
        
        blockSpawnerTimerId = setInterval(createReservationBlock, CONSTANTS.BLOCK_SPAWN_INTERVAL);
    }

    function gameOver() {
        if (isGameOver) return;
        isGameOver = true;
        
        log("GAME: ゲームオーバー");
        sounds.bgm.pause();
        playSound(sounds.gameover);

        dom.finalSalary.innerText = `￥${salary}`;
        dom.restartButton.textContent = (gameMode === 'story') ? "もう一度挑戦する" : "タイトルに戻る";
        
        dom.gameoverScreen.style.display = 'flex';
        cleanupMatterEngine();
    }

    function stageClear() {
        if (isGameOver) return;
        isGameOver = true;
        log("GAME: ステージクリア");
        
        playSound(sounds.combo);
        sounds.bgm.pause();
        
        if (currentStageIndex >= storyData.length - 1) {
            setTimeout(showEnding, 1000);
        } else {
            const stage = storyData[currentStageIndex];
            const postScenario = stage.scenario_post;
            let scenarioText = postScenario.default;

            if (reputation.sincerity > reputation.coldness && reputation.sincerity > reputation.cunning && postScenario.sincerity_route) {
                scenarioText = postScenario.sincerity_route;
            } else if (reputation.coldness > reputation.sincerity && reputation.coldness > reputation.cunning && postScenario.coldness_route) {
                scenarioText = postScenario.coldness_route;
            } else if (cunning > 5 && postScenario.cunning_route) {
                scenarioText = postScenario.cunning_route;
            }
            
            dom.clearScenario.innerHTML = scenarioText.map(p => `<p>${p}</p>`).join('');
            dom.debugReputation.innerHTML = `誠実: ${reputation.sincerity} | 冷徹: ${reputation.coldness} | 狡猾: ${reputation.cunning}`;
            dom.stageClearOverlay.style.display = 'flex';
        }
        cleanupMatterEngine();
    }

    function playSound(audio) {
        const sound = audio.cloneNode();
        sound.volume = audio.volume;
        sound.play().catch(() => {});
    }

    function unlockAchievement(id) {
        if (id && ACHIEVEMENTS[id] && !playerData.unlockedAchievements.has(id)) {
            playerData.unlockedAchievements.add(id);
            showAchievementToast(ACHIEVEMENTS[id].title);
            savePlayerData();
        }
    }

    function unlockRecord(id) {
        if (id && RECORDS[id] && !playerData.unlockedRecords.has(id)) {
            playerData.unlockedRecords.add(id);
            savePlayerData();
        }
    }

    // =============================================
    // ★★★ ブロック生成関数 ★★★
    // =============================================

    function createReservationBlock() {
        if (isGameOver) return;

        let probabilities;
        if (gameMode === 'story') {
            probabilities = storyData[currentStageIndex].block_probabilities;
        } else {
            probabilities = { vip: 0.15, hidden: 0.15, group: 0.1, malware: 0.08, bribe: 0.05, attribute: 0.3 };
        }
        
        if (!probabilities) {
            console.error("block_probabilities が未定義です。", `Stage: ${currentStageIndex}`);
            return;
        }

        const rand = Math.random();
        let cumulativeProb = 0;

        if (rand < (cumulativeProb += probabilities.vip || 0)) createVipBlock();
        else if (rand < (cumulativeProb += probabilities.hidden || 0)) createHiddenBlock();
        else if (rand < (cumulativeProb += probabilities.group || 0)) createGroupBlock();
        else if (rand < (cumulativeProb += probabilities.malware || 0)) createMalwareBlock();
        else if (rand < (cumulativeProb += probabilities.bribe || 0)) createBribeBlock();
        else createNormalBlock(probabilities.attribute || 0);
    }
    
    function createBlock(options, customData) {
        if (!world) return;
        const block = Bodies.rectangle(options.x, options.y, options.w, options.h, options.matter);
        block.customData = customData;
        Composite.add(world, block);
    }

    function createNormalBlock(attributeProb) {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const blockId = Math.floor(Math.random() * 200) + 1;
        
        let attribute = null;
        if (Math.random() < attributeProb) {
            const randAttr = Math.random();
            if (randAttr < 0.33) attribute = 'urgent';
            else if (randAttr < 0.66) attribute = 'important';
            else attribute = 'caution';
        }
        
        createBlock({ x: x, y: -50, w: 120, h: 50, matter: {
            restitution: 0.1, friction: 0.8,
            render: {
                fillStyle: '#3498db',
                strokeStyle: attribute ? ATTRIBUTES[attribute].color : '#ecf0f1',
                lineWidth: attribute ? 4 : 2,
            }
        }}, { id: blockId, type: 'reservation', attribute: attribute });
    }

    function createVipBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        createBlock({ x: x, y: -50, w: 130, h: 60, matter: {
            restitution: 0.1, friction: 0.8, render: { fillStyle: '#f1c40f', strokeStyle: '#ffffff', lineWidth: 3 }
        }}, { id: Math.floor(Math.random() * 200) + 1, type: 'vip', createdAt: Date.now() });
    }

    function createHiddenBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const blockId = Math.floor(Math.random() * 200) + 1;
        createBlock({ x: x, y: -50, w: 120, h: 50, matter: {
            restitution: 0.1, friction: 0.8, render: { fillStyle: '#8e44ad', strokeStyle: '#ecf0f1', lineWidth: 2 },
            angle: Math.random() > 0.5 ? 0.1 : -0.1, angularVelocity: Math.random() > 0.5 ? 0.05 : -0.05
        }}, { id: blockId, type: 'hidden' });
    }

    function createGroupBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const groupSize = Math.floor(Math.random() * 2) + 2;
        const groupId = `group_${groupCounter++}`;
        const blocks = [];
        
        for (let i = 0; i < groupSize; i++) {
            blocks.push(Bodies.rectangle(x + i * 20, -50 - i * 60, 100, 40, {
                restitution: 0.1, friction: 0.8, render: { fillStyle: '#2ecc71', strokeStyle: '#ecf0f1', lineWidth: 2 },
                customData: { id: Math.floor(Math.random() * 200) + 1, type: 'group', groupId: groupId, groupSize: groupSize }
            }));
        }

        const constraints = [];
        for (let i = 0; i < blocks.length - 1; i++) {
            constraints.push(Constraint.create({
                bodyA: blocks[i], bodyB: blocks[i+1], stiffness: 0.5, length: 50,
                render: { strokeStyle: '#ffffff', lineWidth: 2, type: 'line' }
            }));
        }
        if(world) Composite.add(world, [...blocks, ...constraints]);
    }
    
    function createMalwareBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        createBlock({ x: x, y: -50, w: 60, h: 60, matter: {
            restitution: 0.5, friction: 0.5, render: { fillStyle: '#1a1a1a', strokeStyle: '#e74c3c', lineWidth: 4 },
            angularVelocity: (Math.random() - 0.5) * 0.2
        }}, { type: 'malware', createdAt: Date.now() });
    }
    
    function createBribeBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        createBlock({ x: x, y: -50, w: 100, h: 50, matter: {
            restitution: 0.1, friction: 0.8, render: { fillStyle: '#16a085', strokeStyle: '#1abc9c', lineWidth: 3 }
        }}, { type: 'bribe', value: (Math.floor(Math.random() * 5) + 5) * 100 });
    }
    
    // =============================================
    // ★★★ 判定・更新関数 ★★★
    // =============================================

    function judge(body, direction) {
        if (!body || !body.customData) return;
        
        const { type } = body.customData;
        if (type === 'malware') handleMalwarePenalty(body);
        else if (type === 'group') handleGroupJudge(body, direction);
        else if (type === 'bribe') handleBribeJudge(body, direction);
        else handleNormalBlockJudge(body, direction);
    }

    function handleNormalBlockJudge(body, direction) {
        const actualDirection = isControlReversed ? (direction === 'left' ? 'right' : 'left') : direction;
        const requiredAction = getRequiredAction(body.customData);
        const isCorrect = (requiredAction === 'approve' && actualDirection === 'left') || (requiredAction === 'delete' && actualDirection === 'right');

        if (isCorrect) {
            combo++;
            let baseScore = CONSTANTS.SALARY_CORRECT_BASE;
            if (body.customData.type === 'vip') baseScore += CONSTANTS.SALARY_VIP_BONUS;
            else if (body.customData.type === 'hidden') baseScore += CONSTANTS.SALARY_HIDDEN_BONUS;
            salary += Math.floor(baseScore * (1 + Math.floor(combo / 10) * 0.5));
            playSound(sounds.correct);
            if (world) Composite.remove(world, body);
        } else {
            combo = 0;
            salary -= CONSTANTS.SALARY_MISS_PENALTY;
            playSound(sounds.miss);
        }
        updateSalaryDisplay();
        updateComboDisplay();
    }
    
    function handleGroupJudge(body, direction) {
        const { id, groupId, groupSize } = body.customData;
        const actualDirection = isControlReversed ? (direction === 'left' ? 'right' : 'left') : direction;
        const requiredAction = getRequiredAction(body.customData); 
        const isCorrect = (requiredAction === 'approve' && actualDirection === 'left') || (requiredAction === 'delete' && actualDirection === 'right');

        if (isCorrect) {
            playSound(sounds.correct);
            if (!processedGroups[groupId]) processedGroups[groupId] = new Set();
            processedGroups[groupId].add(id);
            body.render.opacity = 0.5;

            const allGroupBodies = Composite.allBodies(world).filter(obj => obj.customData && obj.customData.groupId === groupId);
            const processedCount = processedGroups[groupId].size;
            
            if (processedCount === groupSize) {
                combo++;
                salary += Math.floor(CONSTANTS.SALARY_GROUP_PER_BLOCK * groupSize * (1 + Math.floor(combo / 10) * 0.5));
                
                const groupObjectsToRemove = allGroupBodies.concat(
                    Composite.allConstraints(world).filter(c => 
                        (c.bodyA?.customData?.groupId === groupId) || (c.bodyB?.customData?.groupId === groupId)
                    )
                );
                if (world) Composite.remove(world, groupObjectsToRemove);
                delete processedGroups[groupId];
                playSound(sounds.combo);
            }
        } else {
            playSound(sounds.miss);
            combo = 0;
            salary -= CONSTANTS.SALARY_MISS_PENALTY;
            
            const groupBlocks = Composite.allBodies(world).filter(obj => obj.customData && obj.customData.groupId === groupId);
            groupBlocks.forEach(block => block.render.opacity = 1.0);
            if(processedGroups[groupId]) delete processedGroups[groupId];
        }
        updateSalaryDisplay();
        updateComboDisplay();
    }
    
    function handleBribeJudge(body, direction) {
        const actualDirection = isControlReversed ? (direction === 'left' ? 'right' : 'left') : direction;
        if (actualDirection === 'left') {
            playSound(sounds.correct);
            salary += body.customData.value;
        } else {
            playSound(sounds.miss);
        }
        if (world) Composite.remove(world, body);
        updateSalaryDisplay();
    }

    function handleMalwarePenalty(body) {
        playSound(sounds.miss);
        salary -= CONSTANTS.SALARY_MALWARE_PENALTY;
        updateSalaryDisplay();

        if (controlReverseTimerId) clearTimeout(controlReverseTimerId);
        isControlReversed = true;
        dom.controlReverseIndicator.classList.add('active');

        controlReverseTimerId = setTimeout(() => {
            isControlReversed = false;
            dom.controlReverseIndicator.classList.remove('active');
            controlReverseTimerId = null;
        }, CONSTANTS.CONTROL_REVERSE_DURATION);
        
        if (world) Composite.remove(world, body);
    }
    
    function getRequiredAction(customData) {
        for (const rule of activeRules) {
            if (rule.condition(customData)) {
                return rule.type;
            }
        }
        return 'delete';
    }

    function updateSalaryDisplay() {
        dom.salaryValue.innerText = `￥${salary}`;
        dom.salaryValue.style.color = salary < 0 ? '#e74c3c' : '#ecf0f1';
    }

    function updateComboDisplay() {
        if (combo > 1) {
            dom.comboCount.innerText = combo;
            dom.comboDisplay.style.opacity = '1';
            dom.comboDisplay.classList.add('combo-hit');
            setTimeout(() => dom.comboDisplay.classList.remove('combo-hit'), 100);
        } else {
            dom.comboDisplay.style.opacity = '0';
        }
    }
    
    function addNewRule() {
        if (isGameOver || RULE_POOL.length === 0) return;
        const availableRules = RULE_POOL.filter(rule => !activeRules.some(ar => ar.id === rule.id));
        if (availableRules.length > 0) {
            const newRule = availableRules[Math.floor(Math.random() * availableRules.length)];
            activeRules.push(newRule);
            updateRuleDisplay();
        }
    }

    function updateRuleDisplay() {
        dom.approveList.innerHTML = '';
        dom.deleteList.innerHTML = '';
        
        if (!activeRules) return;

        activeRules.forEach(rule => {
            const li = document.createElement('li');
            li.textContent = `${rule.icon || '・'} ${rule.text}`;
            if (rule.type === 'approve') {
                dom.approveList.appendChild(li);
            } else {
                dom.deleteList.appendChild(li);
            }
        });
    }
    
    function drawBlockText(context, body) {
        context.save();
        context.translate(body.position.x, body.position.y);
        context.rotate(body.angle);
        
        context.font = 'bold 16px "Segoe UI"';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const { type, id, attribute, value } = body.customData;
        let text = '';
        let icon = '';

        if (attribute && ATTRIBUTES[attribute]) icon = ATTRIBUTES[attribute].icon;
        
        if (type === 'vip') {
            context.fillStyle = '#000000';
            text = `👑 VIP ID: ${id}`;
        } else if (type === 'hidden') {
            context.fillStyle = '#ffffff';
            text = `❓ ID: ???`;
        } else if (type === 'group') {
            context.fillStyle = '#ffffff';
            text = `🔗 ID: ${id}`;
        } else if (type === 'malware') {
            context.fillStyle = '#e74c3c';
            context.font = 'bold 24px "Segoe UI"';
            text = `!`;
        } else if (type === 'bribe') {
            context.fillStyle = '#ffffff';
            text = `💰 ${value}円`;
        } else if (type === 'reservation') {
            context.fillStyle = '#ffffff';
            text = `ID: ${id}`;
        }
        
        if (text) {
            context.fillText(`${icon} ${text}`.trim(), 0, 0);
        }

        context.restore();
    }

    function updateVipTimer(body) {
        const elapsedTime = Date.now() - body.customData.createdAt;
        const remainingTimeRatio = 1 - (elapsedTime / CONSTANTS.VIP_TIME_LIMIT);

        if (remainingTimeRatio <= 0) {
            salary -= 200;
            updateSalaryDisplay();
            if (world) Composite.remove(world, body);
            return;
        }

        const context = render.context;
        const barWidth = 100;
        const barHeight = 8;
        
        context.save();
        context.translate(body.position.x, body.position.y);
        context.rotate(body.angle);
        
        const barX = -barWidth / 2;
        const barY = 25;

        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(barX, barY, barWidth, barHeight);
        context.fillStyle = remainingTimeRatio < 0.3 ? '#e74c3c' : '#f1c40f';
        context.fillRect(barX, barY, barWidth * remainingTimeRatio, barHeight);
        
        context.restore();
    }

    // =============================================
    // ★★★ イベントリスナー設定 ★★★
    // =============================================

    // --- ▼▼▼【修正点2】イベントリスナーの登録を責務が明確な2つの関数に分割 ▼▼▼ ---
    /**
     * UIボタンなど、ゲームのライフサイクル全体で有効なリスナーを設定する
     */
    function setupUIEventListeners() {
        log("EVENT: UIイベントリスナー設定");
        dom.storyModeButton.addEventListener('click', () => {
            gameMode = 'story';
            showStageInfo(0);
        });
        dom.endlessModeButton.addEventListener('click', () => {
            gameMode = 'endless';
            showGameScreen();
        });
        dom.stageStartButton.addEventListener('click', () => {
            dom.stageInfoOverlay.style.display = 'none';
            showGameScreen();
        });
        dom.nextStageButton.addEventListener('click', () => {
            if (typeof currentStageIndex === 'number') {
                currentStageIndex++;
                dom.stageClearOverlay.style.display = 'none';
                showStageInfo(currentStageIndex);
            }
        });
        dom.restartButton.addEventListener('click', () => {
            dom.gameoverScreen.style.display = 'none';
            if (gameMode === 'story') {
                showStageInfo(currentStageIndex);
            } else {
                showTitleScreen();
            }
        });
        dom.backToTitleButton.addEventListener('click', showTitleScreen);
        dom.collectionButton.addEventListener('click', () => {
            updateCollectionView();
            dom.collectionScreen.style.display = 'flex';
        });
        dom.collectionBackButton.addEventListener('click', () => {
            dom.collectionScreen.style.display = 'none';
        });
    }

    /**
     * Matter.jsなど、ゲームプレイ中のみ有効なリスナーを設定する
     */
    function setupGameEventListeners() {
        log("EVENT: ゲームプレイイベントリスナー設定");
        Events.on(mouseConstraint, 'mouseup', (event) => {
            if (isGameOver || !mouseConstraint.body) return;
            const body = mouseConstraint.body;
            if (Math.abs(body.velocity.x) > CONSTANTS.FLICK_VELOCITY_THRESHOLD) {
                judge(body, body.velocity.x > 0 ? 'right' : 'left');
            }
        });

        Events.on(render, 'afterRender', () => {
            if (!engine || !world || !render.context) return;
            const context = render.context;
            
            Composite.allBodies(world).forEach(body => {
                if (body.customData && body.customData.type !== 'particle') {
                    drawBlockText(context, body);
                    if (body.customData.type === 'vip') updateVipTimer(body);
                    
                    if (body.customData.type === 'malware' && Date.now() - body.customData.createdAt > CONSTANTS.MALWARE_LIFETIME) {
                        if (world) Composite.remove(world, body);
                        unlockAchievement('malware_avoid');
                    }
                    
                    if (isGameOver) return;

                    const DEAD_LINE_Y = window.innerHeight * CONSTANTS.DEAD_LINE_Y_RATIO;
                    if (!body.isStatic && body.isSleeping) {
                        if (body.bounds.min.y < DEAD_LINE_Y) {
                            log(`デッドライン超過を検知！`, body.customData);
                            gameOver();
                        }
                    }
                }
            });

            if (gameMode === 'story' && !isGameOver && currentClearCondition?.type === 'salary' && salary >= currentClearCondition.value) {
                stageClear();
            }
        });
    }
    
    // =============================================
    // ★★★ 初期化処理 ★★★
    // =============================================
    
    log("INIT: 初期化処理開始");
    setupUIEventListeners(); // UIボタンのリスナーは最初に一度だけ設定
    loadPlayerData();
    loadGameData().then(() => {
        log("INIT: データロード完了、タイトル表示へ");
        showTitleScreen();
    }).catch(e => {
        console.error("初期化中の致命的なエラー:", e);
        alert("ゲームの初期化に失敗しました。コンソールを確認してください。");
    });
});
