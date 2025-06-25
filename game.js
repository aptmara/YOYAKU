document.addEventListener('DOMContentLoaded', () => {
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
        DEAD_LINE_Y_RATIO: 0.25, // 画面高さに対するデッドラインの割合
        FLICK_VELOCITY_THRESHOLD: 5,
        BLOCK_SPAWN_INTERVAL: 2000,
        RULE_ADD_INTERVAL: 15000,
        CONTROL_REVERSE_DURATION: 5000,
        MALWARE_LIFETIME: 10000,
        VIP_TIME_LIMIT: 8000,
        SALARY_CORRECT_BASE: 100,
        SALARY_MISS_PENALTY: 50,
        SALARY_MALWARE_PENALTY: 150,
        SALARY_VIP_BONUS: 200, // VIPの基本報酬 (SALARY_CORRECT_BASE + SALARY_VIP_BONUS)
        SALARY_HIDDEN_BONUS: 150, // 隠蔽ブロックの基本報酬
        SALARY_GROUP_PER_BLOCK: 150, // グループブロック1つあたりの報酬
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

    // RULE_POOLは外部ファイルから読み込むため、ここでは定義しない
    let RULE_POOL = []; // ロード後にルールが格納される

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
    let rulesMap = new Map(); // ルールIDからルールオブジェクトへのマッピング

    // --- プレイヤーデータ ---
    let playerData = {
        unlockedAchievements: new Set(),
        unlockedRecords: new Set()
    };
    
    // =============================================
    // ★★★ データ管理関数 ★★★
    // =============================================
    
    /**
     * ローカルストレージからプレイヤーデータをロードする。
     */
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
            playerData = { unlockedAchievements: new Set(), unlockedRecords: new Set() }; // エラー時は初期化
        }
    }
    
    /**
     * プレイヤーデータをローカルストレージに保存する。
     */
    function savePlayerData() {
        const dataToSave = {
            unlockedAchievements: Array.from(playerData.unlockedAchievements),
            unlockedRecords: Array.from(playerData.unlockedRecords)
        };
        localStorage.setItem('reserve_delete_playerData', JSON.stringify(dataToSave));
    }

    /**
     * ゲームデータ (ルール、ストーリー、エンディング) をロードする。
     */
    async function loadGameData() {
        try {
            // rules.jsonを最初に読み込む
            const [rulesResponse, storyResponse, endingResponse] = await Promise.all([
                fetch('rules.json'),
                fetch('story.json'),
                fetch('endings.json')
            ]);

            const rawRulesData = await rulesResponse.json();
            const rawStoryData = await await storyResponse.json(); //
            endingData = await endingResponse.json(); //

            // RULE_POOLとrulesMapを構築
            RULE_POOL = rawRulesData.map(rule => { //
                // condition文字列をFunctionに変換 (信頼できるソースからのみ使用)
                return { ...rule, condition: new Function('b', `return ${rule.condition}`) }; //
            });
            RULE_POOL.forEach(rule => { //
                rulesMap.set(rule.id, rule); //
            });

            // storyDataを処理し、rules.jsonから対応するルールを割り当てる
            storyData = rawStoryData.map(stage => { //
                return {
                    ...stage,
                    rules: stage.rules.map(stageRule => { //
                        // ★修正箇所★ ここから追加
                        if (!stageRule || typeof stageRule.id === 'undefined') {
                            console.warn("WARN: story.json内のルール定義に不正なエントリが見つかりました（IDがundefinedまたは欠落）。");
                            return { type: 'delete', text: '不正なルール', icon: '❓', condition: (b) => true }; // フォールバック
                        }
                        // ★修正箇所★ ここまで追加

                        const ruleFromPool = rulesMap.get(stageRule.id); //
                        if (ruleFromPool) { //
                            // rules.jsonから見つかったルールの詳細を使用
                            return {
                                type: ruleFromPool.type,
                                text: ruleFromPool.text,
                                icon: ruleFromPool.icon,
                                condition: ruleFromPool.condition // 関数化されたcondition
                            };
                        } else {
                            console.warn(`WARN: story.json内のルールID '${stageRule.id}' に対応するルールがrules.jsonに見つかりませんでした。`); //
                            return { type: 'delete', text: '不明なルール', icon: '❓', condition: (b) => true }; // フォールバック
                        }
                    })
                };
            });
            console.log("ゲームデータの読み込みが完了しました。"); //
        } catch (error) {
            console.error("ゲームデータの読み込みに失敗しました:", error); //
            // エラー発生時のフォールバック処理
            RULE_POOL = []; //
            storyData = []; //
            endingData = { normal_end: { title: "エラー", scenario: ["データの読み込みに失敗しました。"] } }; //
        }
    }
    
    // =============================================
    // ★★★ UI/画面遷移関数 ★★★
    // =============================================
    // showTitleScreen, showGameScreen, showStageInfo, showEnding,
    // updateCollectionView, showAchievementToast ... (前回の game.js と同じ)

    /**
     * タイトル画面を表示する。
     */
    /**
     * タイトル画面を表示する。
     */
    function showTitleScreen() {
        // 全てのゲーム関連画面を非表示にする
        // これにより、初期化時に他の画面要素が誤って表示されることを防ぎます。
        dom.gameMainScreen.style.display = 'none';
        dom.stageInfoOverlay.style.display = 'none';
        dom.stageClearOverlay.style.display = 'none';
        dom.gameoverScreen.style.display = 'none';
        dom.endingScreen.style.display = 'none';
        dom.collectionScreen.style.display = 'none';
        dom.achievementToast.style.display = 'none'; // トーストも非表示に

        // タイトル画面コンテナを表示
        dom.titleScreen.style.display = 'flex'; //

        // タイトル画面内のボタンを表示
        // style.cssの定義に従い、必要に応じてdisplayプロパティを設定します。
        // .mode-buttonは通常inline-block、.sub-buttonはblockが適しています。
        dom.storyModeButton.style.display = 'inline-block';
        dom.endlessModeButton.style.display = 'inline-block';
        dom.collectionButton.style.display = 'block';

        sounds.bgm.pause(); //
        if(sounds.bgm.currentTime > 0) sounds.bgm.currentTime = 0; //
        cleanupMatterEngine(); // Matter.jsインスタンスをクリーンアップ
    }
    
        /**
     * ゲームメイン画面を表示し、ゲームを開始する。
     */
    function showGameScreen() {
        Object.values(dom).forEach(el => {
            if (el && el.style) el.style.display = 'none';
        });
        dom.gameMainScreen.style.display = 'block';
        gameStart();
    }

    /**
     * ステージ情報オーバーレイを表示する。
     * @param {number} stageIndex - 表示するステージのインデックス。
     */
    function showStageInfo(stageIndex) {
        const stage = storyData[stageIndex];
        if (!stage) {
            // 全ステージクリア時の処理
            showEnding();
            return;
        }
        currentStageIndex = stageIndex;
        dom.stageTitle.textContent = `STAGE ${stage.stage}: ${stage.title}`;
        dom.stageScenario.innerHTML = stage.scenario_pre.map(p => `<p>${p}</p>`).join('');
        dom.stageClearCondition.textContent = `${stage.clear_condition.value}円の給料を稼ぐ`;
        dom.stageInfoOverlay.style.display = 'flex';
    }
    

    /**
     * エンディング画面を表示する。
     */
    function showEnding() {
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
        
        dom.endingScreen.style.display = 'flex';
        cleanupMatterEngine(); // Matter.jsインスタンスをクリーンアップ
    }

    /**
     * 実績・記録庫画面の表示を更新する。
     */
    function updateCollectionView() {
        dom.achievementsList.innerHTML = '';
        for (const id in ACHIEVEMENTS) {
            const ach = ACHIEVEMENTS[id];
            const li = document.createElement('li');
            if (playerData.unlockedAchievements.has(id)) {
                li.className = 'unlocked';
                li.innerHTML = `${ach.title} <span class="desc">- ${ach.desc}</span>`;
            } else {
                li.innerHTML = `??? <span class="desc">- ${ach.desc}</span>`;
            }
            dom.achievementsList.appendChild(li);
        }

        dom.recordsList.innerHTML = '';
        for (const id in RECORDS) {
            const rec = RECORDS[id];
            const li = document.createElement('li');
            if (playerData.unlockedRecords.has(id)) {
                li.className = 'unlocked';
                li.textContent = rec.text;
            } else {
                li.textContent = '???';
            }
            dom.recordsList.appendChild(li);
        }
    }

    /**
     * 実績達成通知 (トースト) を表示する。
     * @param {string} title - 表示する実績のタイトル。
     */
    function showAchievementToast(title) {
        dom.toastText.textContent = `実績解除: ${title}`;
        dom.achievementToast.style.bottom = '20px';
        setTimeout(() => {
            dom.achievementToast.style.bottom = '-100px';
        }, 3000);
    }
    
    // =============================================
    // ★★★ ゲームロジック関数 ★★★
    // =============================================

    /**
     * Matter.jsのエンジン、レンダラー、ランナーをクリーンアップする。
     */
    function cleanupMatterEngine() {
        if (runner) {
            Runner.stop(runner);
            runner = null;
        }
        if (render && render.canvas) {
            Render.stop(render);
            render.canvas.remove();
            render = null;
        }
        if (engine) {
            Engine.clear(engine);
            engine = null;
            world = null;
        }
        if (mouseConstraint) {
            // mouseConstraintがworldに追加されている場合のみ削除
            if (world && mouseConstraint.body) {
                Composite.remove(world, mouseConstraint); 
            }
            mouseConstraint = null;
        }
    }

    /**
     * ゲームを初期化し、開始する。
     */
    function gameStart() {
        // 既存のMatter.jsインスタンスがあればクリーンアップ
        cleanupMatterEngine();

        // --- 初期化 ---
        isGameOver = false;
        salary = 0;
        combo = 0;
        reputation = { sincerity: 0, coldness: 0, cunning: 0 };
        groupCounter = 0;
        processedGroups = {};
        isControlReversed = false;
        if(controlReverseTimerId) clearTimeout(controlReverseTimerId);
        dom.controlReverseIndicator.classList.remove('active');
        
        updateSalaryDisplay();
        updateComboDisplay();
        
        sounds.bgm.play().catch(e => console.warn("BGM再生にはユーザー操作が必要です:", e));

        // --- 物理エンジンセットアップ ---
        engine = Engine.create();
        world = engine.world;
        render = Render.create({
            element: dom.gameContainer,
            engine: engine,
            options: { width: window.innerWidth, height: window.innerHeight, wireframes: false, background: '#2c3e50' }
        });
        
        // Canvas要素が既に存在する場合は削除し、新たに追加
        while (dom.gameContainer.firstChild) {
            dom.gameContainer.removeChild(dom.gameContainer.firstChild);
        }
        dom.gameContainer.appendChild(render.canvas);
        
        runner = Runner.create();
        
        const wallOptions = { isStatic: true, render: { visible: false } };
        const ground = Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 30, window.innerWidth, 60, wallOptions);
        const leftWall = Bodies.rectangle(-30, window.innerHeight / 2, 60, window.innerHeight, wallOptions);
        const rightWall = Bodies.rectangle(window.innerWidth + 30, window.innerHeight / 2, 60, window.innerHeight, wallOptions);
        Composite.add(world, [ground, leftWall, rightWall]);

        const mouse = Mouse.create(render.canvas);
        mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: { stiffness: 0.2, render: { visible: false } }
        });
        Composite.add(world, mouseConstraint);

        // --- モード別初期設定 ---
        if (gameMode === 'story') {
            const stage = storyData[currentStageIndex];
            activeRules = stage.rules;
            currentClearCondition = stage.clear_condition;
            updateRuleDisplay();
        } else { // Endless Mode
            activeRules = [];
            addNewRule();
            updateRuleDisplay();
            ruleAddTimerId = setInterval(addNewRule, CONSTANTS.RULE_ADD_INTERVAL);
        }

        // --- 実行開始 ---
        setupEventListeners();
        Render.run(render);
        Runner.run(runner, engine);
        blockSpawnerTimerId = setInterval(createReservationBlock, CONSTANTS.BLOCK_SPAWN_INTERVAL);
    }

    /**
     * ゲームオーバー処理。
     */
    function gameOver() {
        if (isGameOver) return;
        isGameOver = true;
        
        sounds.bgm.pause();
        playSound(sounds.gameover);

        // タイマーをクリア
        if(ruleAddTimerId) clearInterval(ruleAddTimerId);
        if(blockSpawnerTimerId) clearInterval(blockSpawnerTimerId);
        if(controlReverseTimerId) clearTimeout(controlReverseTimerId);

        cleanupMatterEngine(); // Matter.jsインスタンスをクリーンアップ

        dom.finalSalary.innerText = `￥${salary}`;
        
        if (gameMode === 'story') {
            dom.restartButton.textContent = "もう一度挑戦する";
            const failedStageIndex = currentStageIndex;
            dom.restartButton.onclick = () => {
                dom.gameoverScreen.style.display = 'none';
                showStageInfo(failedStageIndex); // 失敗したステージから再開
            };
        } else {
            dom.restartButton.textContent = "タイトルに戻る";
            dom.restartButton.onclick = () => {
                dom.gameoverScreen.style.display = 'none';
                showTitleScreen();
            };
        }
        
        dom.gameoverScreen.style.display = 'flex';
    }

    /**
     * ステージクリア処理。
     */
    function stageClear() {
        if (isGameOver) return;
        isGameOver = true;
        
        playSound(sounds.combo);

        // タイマーをクリア
        if(ruleAddTimerId) clearInterval(ruleAddTimerId);
        if(blockSpawnerTimerId) clearInterval(blockSpawnerTimerId);
        if(controlReverseTimerId) clearTimeout(controlReverseTimerId);

        cleanupMatterEngine(); // Matter.jsインスタンスをクリーンアップ
        sounds.bgm.pause();
        
        console.log("--- FINAL REPUTATION ---");
        console.log(reputation);
        
        if (currentStageIndex >= storyData.length - 1) {
            // 最終ステージクリア
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
    }

    /**
     * サウンドを再生する。
     * @param {HTMLAudioElement} audio - 再生するAudioオブジェクト。
     */
    function playSound(audio) {
        // 短時間で連続再生される可能性のあるサウンドは、cloneNodeで新しいインスタンスを生成して再生
        const sound = audio.cloneNode();
        sound.volume = audio.volume;
        sound.play().catch(e => { /* 再生エラーは無視 */ });
    }

    /**
     * 実績を解除する。
     * @param {string} id - 解除する実績のID。
     */
    function unlockAchievement(id) {
        if (id && ACHIEVEMENTS[id] && !playerData.unlockedAchievements.has(id)) {
            playerData.unlockedAchievements.add(id);
            showAchievementToast(ACHIEVEMENTS[id].title);
            savePlayerData();
        }
    }

    /**
     * 記録を解除する。
     * @param {string} id - 解除する記録のID。
     */
    function unlockRecord(id) {
        if (id && RECORDS[id] && !playerData.unlockedRecords.has(id)) {
            playerData.unlockedRecords.add(id);
            savePlayerData();
        }
    }

    // =============================================
    // ★★★ ブロック生成関数 ★★★
    // =============================================

    /**
     * 予約ブロックを生成する。
     */
    function createReservationBlock() {
        if (isGameOver) return;

        let probabilities;
        if (gameMode === 'story') {
            probabilities = storyData[currentStageIndex].block_probabilities;
        } else { // Endless
            probabilities = { vip: 0.15, hidden: 0.15, group: 0.1, malware: 0.08, bribe: 0.05, attribute: 0.3 };
        }
        
        const rand = Math.random();
        let cumulativeProb = 0;

        if (rand < (cumulativeProb += probabilities.vip)) createVipBlock();
        else if (rand < (cumulativeProb += probabilities.hidden)) createHiddenBlock();
        else if (rand < (cumulativeProb += probabilities.group)) createGroupBlock();
        else if (rand < (cumulativeProb += probabilities.malware)) createMalwareBlock();
        else if (rand < (cumulativeProb += probabilities.bribe)) createBribeBlock();
        else createNormalBlock(probabilities.attribute);
    }

    /**
     * 通常の予約ブロックを生成する。
     * @param {number} attributeProb - 属性が付与される確率。
     */
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
        
        const block = Bodies.rectangle(x, -50, 120, 50, {
            restitution: 0.1, friction: 0.8,
            render: {
                fillStyle: '#3498db',
                strokeStyle: attribute ? ATTRIBUTES[attribute].color : '#ecf0f1',
                lineWidth: attribute ? 4 : 2,
            },
            customData: { id: blockId, type: 'reservation', attribute: attribute }
        });
        Composite.add(world, block);
    }

    /**
     * VIPブロックを生成する。
     */
    function createVipBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const blockId = Math.floor(Math.random() * 200) + 1;
        const block = Bodies.rectangle(x, -50, 130, 60, {
            restitution: 0.1, friction: 0.8,
            render: { fillStyle: '#f1c40f', strokeStyle: '#ffffff', lineWidth: 3 },
            customData: { id: blockId, type: 'vip', createdAt: Date.now() }
        });
        Composite.add(world, block);
    }
    
    /**
     * 隠蔽ブロックを生成する。
     */
    function createHiddenBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const blockId = Math.floor(Math.random() * 200) + 1;
        const isEven = blockId % 2 === 0;
        const block = Bodies.rectangle(x, -50, 120, 50, {
            restitution: 0.1, friction: 0.8,
            render: { fillStyle: '#8e44ad', strokeStyle: '#ecf0f1', lineWidth: 2 },
            customData: { id: blockId, type: 'hidden' },
            angle: isEven ? 0.1 : -0.1,
            angularVelocity: isEven ? 0.05 : -0.05
        });
        Composite.add(world, block);
    }

    /**
     * グループブロックを生成する。
     */
    function createGroupBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const groupSize = Math.floor(Math.random() * 2) + 2; // 2〜3個のグループ
        const groupId = `group_${groupCounter++}`;
        const blocks = [];
        
        for (let i = 0; i < groupSize; i++) {
            const blockId = Math.floor(Math.random() * 200) + 1;
            const block = Bodies.rectangle(x + i * 20, -50 - i * 60, 100, 40, {
                restitution: 0.1, friction: 0.8,
                render: { fillStyle: '#2ecc71', strokeStyle: '#ecf0f1', lineWidth: 2 },
                customData: { id: blockId, type: 'group', groupId: groupId, groupSize: groupSize }
            });
            blocks.push(block);
        }

        const constraints = [];
        for (let i = 0; i < blocks.length - 1; i++) {
            const constraint = Constraint.create({
                bodyA: blocks[i],
                bodyB: blocks[i+1],
                stiffness: 0.5,
                length: 50,
                render: { strokeStyle: '#ffffff', lineWidth: 2, type: 'line' }
            });
            constraints.push(constraint);
        }
        Composite.add(world, [...blocks, ...constraints]);
    }
    
    /**
     * 妨害ブロックを生成する。
     */
    function createMalwareBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const block = Bodies.rectangle(x, -50, 60, 60, {
            restitution: 0.5, friction: 0.5,
            render: { fillStyle: '#1a1a1a', strokeStyle: '#e74c3c', lineWidth: 4 },
            customData: { type: 'malware', createdAt: Date.now() },
            angularVelocity: (Math.random() - 0.5) * 0.2
        });
        Composite.add(world, block);
    }
    
    /**
     * 賄賂ブロックを生成する。
     */
    function createBribeBlock() {
        const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
        const score = (Math.floor(Math.random() * 5) + 5) * 100; // 500〜900円
        const block = Bodies.rectangle(x, -50, 100, 50, {
            restitution: 0.1, friction: 0.8,
            render: { fillStyle: '#16a085', strokeStyle: '#1abc9c', lineWidth: 3 },
            customData: { type: 'bribe', value: score }
        });
        Composite.add(world, block);
    }
    
    // =============================================
    // ★★★ 判定・更新関数 ★★★
    // =============================================

    /**
     * ブロックの処理を判定し、ゲーム状態を更新する。
     * @param {object} body - Matter.jsのBodyオブジェクト。
     * @param {'left'|'right'} direction - ブロックがフリックされた方向。
     */
    function judge(body, direction) {
        if (!body.customData) return;
        const { type } = body.customData;
        
        switch (type) {
            case 'malware':
                handleMalwarePenalty(body);
                return;
            case 'group':
                handleGroupJudge(body, direction);
                return;
            case 'bribe':
                handleBribeJudge(body, direction);
                return;
            default:
                handleNormalBlockJudge(body, direction);
                break;
        }
    }

    /**
     * 通常ブロック（reservation, vip, hidden）の判定処理。
     * @param {object} body - Matter.jsのBodyオブジェクト。
     * @param {'left'|'right'} direction - ブロックがフリックされた方向。
     */
    function handleNormalBlockJudge(body, direction) {
        const { type } = body.customData;
        let actualDirection = isControlReversed ? (direction === 'left' ? 'right' : 'left') : direction;
        
        let requiredAction = getRequiredAction(body.customData);
        let isCorrect = (requiredAction === 'approve' && actualDirection === 'left') || (requiredAction === 'delete' && actualDirection === 'right');

        if (isCorrect) {
            combo++;
            const comboBonus = Math.max(1, Math.floor(combo / 10) * 0.5 + 1);
            let baseScore = CONSTANTS.SALARY_CORRECT_BASE;

            if (type === 'vip') { 
                baseScore += CONSTANTS.SALARY_VIP_BONUS; 
                reputation.coldness += CONSTANTS.REP_COLDNESS_VIP;
                unlockAchievement('vip_handle');
                unlockRecord('vip');
            } else if (type === 'hidden') { 
                baseScore += CONSTANTS.SALARY_HIDDEN_BONUS; 
                reputation.coldness += CONSTANTS.REP_COLDNESS_HIDDEN;
                unlockAchievement('hidden_solve');
                unlockRecord('hidden');
            } else { 
                reputation.sincerity += CONSTANTS.REP_SINCERITY_NORMAL; 
            }
            salary += Math.floor(baseScore * comboBonus);
            
            unlockAchievement('first_job');
            if(combo >= 10) unlockAchievement('combo_10');
            if(combo >= 50) unlockAchievement('combo_50');
            
            unlockRecord(body.customData.attribute); // 属性も記録

            if (combo > 0 && combo % 10 === 0) playSound(sounds.combo);
            else playSound(sounds.correct);
            
            spawnParticles(body.position.x, body.position.y, body.render.fillStyle);
            Composite.remove(world, body);
        } else {
            combo = 0;
            salary -= CONSTANTS.SALARY_MISS_PENALTY;
            playSound(sounds.miss);
        }
        updateSalaryDisplay();
        updateComboDisplay();
    }
    
    /**
     * グループブロックの判定処理。
     * @param {object} body - Matter.jsのBodyオブジェクト。
     * @param {'left'|'right'} direction - ブロックがフリックされた方向。
     */
    function handleGroupJudge(body, direction) {
        const { id, groupId, groupSize } = body.customData;
        let actualDirection = isControlReversed ? (direction === 'left' ? 'right' : 'left') : direction;
        let requiredAction = getRequiredAction(body.customData); 
        
        const isCorrect = (requiredAction === 'approve' && actualDirection === 'left') || (requiredAction === 'delete' && actualDirection === 'right');

        if (isCorrect) {
            playSound(sounds.correct);
            if (!processedGroups[groupId]) processedGroups[groupId] = new Set();
            processedGroups[groupId].add(id);
            body.render.opacity = 0.5; // 処理済みブロックは半透明に

            // グループ内の全ブロックが処理されたか確認
            const allGroupBodies = Composite.allBodies(world).filter(obj => obj.customData && obj.customData.groupId === groupId);
            const processedCount = processedGroups[groupId].size;
            
            if (processedCount === groupSize) { // 全て処理された
                combo++;
                const comboBonus = Math.max(1, Math.floor(combo / 10) * 0.5 + 1);
                salary += Math.floor(CONSTANTS.SALARY_GROUP_PER_BLOCK * groupSize * comboBonus);
                reputation.sincerity += (CONSTANTS.REP_SINCERITY_GROUP_PER_BLOCK * groupSize);
                
                // グループを構成する全てのボディとコンストレインを削除
                const groupObjectsToRemove = allGroupBodies.concat(
                    Composite.allConstraints(world).filter(c => 
                        (c.bodyA && c.bodyA.customData && c.bodyA.customData.groupId === groupId) ||
                        (c.bodyB && c.bodyB.customData && c.bodyB.customData.groupId === groupId)
                    )
                );
                Composite.remove(world, groupObjectsToRemove);
                delete processedGroups[groupId];
                playSound(sounds.combo);
                unlockAchievement('group_clear');
                unlockRecord('group');
            }
        } else {
            // 不正解の場合はコンボリセット、ペナルティ、グループの状態をリセット
            playSound(sounds.miss);
            combo = 0;
            salary -= CONSTANTS.SALARY_MISS_PENALTY;
            
            // グループ内のブロックを再度不透明に戻す
            const groupBlocks = Composite.allBodies(world).filter(obj => obj.customData && obj.customData.groupId === groupId);
            groupBlocks.forEach(block => block.render.opacity = 1.0);
            delete processedGroups[groupId]; // 処理状態をリセット
        }
        updateSalaryDisplay();
        updateComboDisplay();
    }
    
    /**
     * 賄賂ブロックの判定処理。
     * @param {object} body - Matter.jsのBodyオブジェクト。
     * @param {'left'|'right'} direction - ブロックがフリックされた方向。
     */
    function handleBribeJudge(body, direction) {
        let actualDirection = isControlReversed ? (direction === 'left' ? 'right' : 'left') : direction;
        if (actualDirection === 'left') { // 承認（賄賂を受け取る）
            playSound(sounds.correct);
            salary += body.customData.value;
            reputation.cunning += CONSTANTS.REP_CUNNING_BRIBE;
            unlockAchievement('cunning_choice');
            unlockRecord('bribe');
        } else { // 破棄（賄賂を拒否）
            playSound(sounds.miss);
            // 賄賂を拒否した場合、ペナルティはないが評判が上がる
            reputation.sincerity += CONSTANTS.REP_SINCERITY_BRIBE_REFUSE;
        }
        Composite.remove(world, body);
        updateSalaryDisplay();
    }
    
    /**
     * 妨害ブロックの処理（ペナルティを与える）。
     * @param {object} body - Matter.jsのBodyオブジェクト。
     */
    function handleMalwarePenalty(body) {
        playSound(sounds.miss);
        salary -= CONSTANTS.SALARY_MALWARE_PENALTY;
        updateSalaryDisplay();
        unlockRecord('malware');

        if (controlReverseTimerId) clearTimeout(controlReverseTimerId);
        isControlReversed = true;
        dom.controlReverseIndicator.classList.add('active');

        controlReverseTimerId = setTimeout(() => {
            isControlReversed = false;
            dom.controlReverseIndicator.classList.remove('active');
            controlReverseTimerId = null;
        }, CONSTANTS.CONTROL_REVERSE_DURATION);
        
        Composite.remove(world, body);
    }

    /**
     * ブロックのカスタムデータに基づいて必要なアクション (承認/破棄) を決定する。
     * @param {object} customData - ブロックのカスタムデータ。
     * @returns {'approve'|'delete'|'pass'} - 必要なアクション。
     */
    function getRequiredAction(customData) {
        let action = 'pass';
        let rulesToCheck = (gameMode === 'endless') ? RULE_POOL : storyData[currentStageIndex].rules; // RULE_POOLを使う
        for (const rule of rulesToCheck) {
            if (rule.condition(customData)) { // rule.conditionは関数として定義されている
                action = rule.type;
                break;
            }
        }
        return (action === 'pass') ? 'delete' : action; // どのルールにも当てはまらない場合は破棄
    }

    /**
     * 給料表示を更新する。
     */
    function updateSalaryDisplay() {
        dom.salaryValue.innerText = `￥${salary}`;
        dom.salaryValue.style.color = salary < 0 ? '#e74c3c' : '#ecf0f1';
    }

    /**
     * コンボ表示を更新する。
     */
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
    
    /**
     * 新しいルールをゲームに追加する (エンドレスモード用)。
     */
    function addNewRule() {
        if (isGameOver || RULE_POOL.length === 0) return;
        // RULE_POOLからまだactiveRulesに含まれていないルールをランダムに選択
        const availableRules = RULE_POOL.filter(rule => !activeRules.includes(rule));
        if (availableRules.length === 0) {
            console.warn("全てのルールが既に追加されています。");
            return;
        }
        const newRule = availableRules[Math.floor(Math.random() * availableRules.length)];
        activeRules.push(newRule);
        updateRuleDisplay();
    }

    /**
     * ルール表示を更新する。
     */
    function updateRuleDisplay() {
        dom.approveList.innerHTML = '';
        dom.deleteList.innerHTML = '';
        let rulesToShow = (gameMode === 'endless') ? activeRules : storyData[currentStageIndex].rules;
        rulesToShow.forEach(rule => {
            const li = document.createElement('li');
            li.textContent = `${rule.icon || '・'} ${rule.text}`;
            if (rule.type === 'approve') dom.approveList.appendChild(li);
            else dom.deleteList.appendChild(li);
        });
    }
    
    /**
     * 指定した位置にパーティクルを生成する。
     * @param {number} x - X座標。
     * @param {number} y - Y座標。
     * @param {string} color - パーティクルの色。
     */
    function spawnParticles(x, y, color) {
        for (let i = 0; i < 10; i++) {
            const particle = Bodies.circle(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, Math.random() * 3 + 1, {
                restitution: 0.8,
                friction: 0.9,
                render: { fillStyle: color },
                isSensor: true,
                customData: { type: 'particle' }
            });
            Matter.Body.setVelocity(particle, { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 });
            Composite.add(world, particle);
            setTimeout(() => Composite.remove(world, particle), 500 + Math.random() * 500); // 一定時間後に削除
        }
    }

    /**
     * Matter.jsのレンダリング後にブロックのテキストを描画する。
     * @param {CanvasRenderingContext2D} context - 描画コンテキスト。
     * @param {object} body - Matter.jsのBodyオブジェクト。
     */
    function drawBlockText(context, body) {
        context.font = 'bold 16px "Segoe UI"';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const { type, id, attribute } = body.customData;
        let text = '';
        let icon = '';

        if (attribute && ATTRIBUTES[attribute]) {
            icon = ATTRIBUTES[attribute].icon;
        }
        
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
            text = `💰 ${body.customData.value}円`;
        } else if (type === 'reservation') {
            context.fillStyle = '#ffffff';
            text = `ID: ${id}`;
        }
        
        if (text) {
            context.fillText(`${icon} ${text}`.trim(), body.position.x, body.position.y);
        }
    }

    /**
     * VIPブロックの残り時間タイマーを描画し、時間切れを処理する。
     * @param {object} body - Matter.jsのBodyオブジェクト。
     */
    function updateVipTimer(body) {
        const elapsedTime = Date.now() - body.customData.createdAt;
        const remainingTimeRatio = 1 - (elapsedTime / CONSTANTS.VIP_TIME_LIMIT);

        if (remainingTimeRatio <= 0) {
            salary -= 200; // 時間切れペナルティ
            updateSalaryDisplay();
            spawnParticles(body.position.x, body.position.y, '#e74c3c');
            Composite.remove(world, body);
            return;
        }

        const context = render.context;
        const barWidth = 100;
        const barHeight = 8;
        const barX = body.position.x - barWidth / 2;
        const barY = body.position.y + 25;

        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(barX, barY, barWidth, barHeight);

        context.fillStyle = remainingTimeRatio < 0.3 ? '#e74c3c' : '#f1c40f';
        context.fillRect(barX, barY, barWidth * remainingTimeRatio, barHeight);
    }


    // =============================================
    // ★★★ イベントリスナー設定 ★★★
    // =============================================

    /**
     * ゲーム全体のイベントリスナーを設定する。
     */
    function setupEventListeners() {
        // マウスフリックによるブロック処理
        Events.on(mouseConstraint, 'mouseup', (event) => {
            if (isGameOver || !mouseConstraint.body) return;
            const body = mouseConstraint.body;
            const velocityX = body.velocity.x;
            if (Math.abs(velocityX) > CONSTANTS.FLICK_VELOCITY_THRESHOLD) {
                judge(body, velocityX > 0 ? 'right' : 'left');
            }
        });

        // 毎フレームごとのレンダリング後イベント
   Events.on(render, 'afterRender', () => {
            if (isGameOver) return;
            const context = render.context;
            
            // Matter.js v0.19.0ではComposite.allBodies(world)が推奨
            Composite.allBodies(world).forEach(body => {
                if (body.customData && body.customData.type !== 'particle') { // パーティクルは除外
                    drawBlockText(context, body);
                    if (body.customData.type === 'vip') updateVipTimer(body);
                    
                    // 妨害ブロックの寿命判定
                    if (body.customData.type === 'malware' && Date.now() - body.customData.createdAt > CONSTANTS.MALWARE_LIFETIME) {
                        spawnParticles(body.position.x, body.position.y, '#555555');
                        Composite.remove(world, body);
                        unlockAchievement('malware_avoid');
                    }

                    // デッドラインを超えたブロックのゲームオーバー判定
                    const DEAD_LINE_Y = window.innerHeight * CONSTANTS.DEAD_LINE_Y_RATIO;
                    // 【修正点】
                    // 判定条件を `body.position.y < DEAD_LINE_Y` から `body.position.y > DEAD_LINE_Y` に変更。
                    // Matter.jsの座標系ではY軸は下向きが正のため、これにより「ブロックがデッドラインより下に到達した」
                    // という正しい条件になります。
                    // さらに、`body.velocity.y` の絶対値を見ることで、跳ね返りなどで一瞬デッドラインを越えただけでは
                    // ゲームオーバーにならないように、より安定した判定にしています。
                    if (body.position.y > DEAD_LINE_Y && Math.abs(body.velocity.y) < 0.1 && body.isStatic === false) {
                        gameOver();
                    }
                }
            });

            // ストーリーモードのクリア条件判定
            if (gameMode === 'story' && !isGameOver && currentClearCondition) {
                if (currentClearCondition.type === 'salary' && salary >= currentClearCondition.value) {
                    stageClear();
                }
            }
        });
    }

    // --- DOMイベントリスナー設定 ---
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
        dom.stageClearOverlay.style.display = 'none';
        showStageInfo(currentStageIndex + 1);
    });
    dom.backToTitleButton.addEventListener('click', () => {
        dom.endingScreen.style.display = 'none';
        showTitleScreen();
    });
    dom.collectionButton.addEventListener('click', () => {
        updateCollectionView();
        dom.collectionScreen.style.display = 'flex';
    });
    dom.collectionBackButton.addEventListener('click', () => {
        dom.collectionScreen.style.display = 'none';
    });
    
    // =============================================
    // ★★★ 初期化処理 ★★★
    // =============================================
    
    loadPlayerData();
    loadGameData().then(() => {
        showTitleScreen();
    }).catch(e => {
        console.error("初期ゲームデータの読み込み中に致命的なエラーが発生しました:", e);
        alert("ゲームの初期化中にエラーが発生しました。ページをリロードしてください。");
    });
});