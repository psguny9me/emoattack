// Main Game Logic - 게임 루프 및 상태 관리

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // 게임 상태
        this.state = 'menu'; // menu, playing, paused, gameover, victory
        this.gold = 200;
        this.lives = 20;
        this.score = 0;

        // 시스템
        this.pathSystem = null;
        this.waveManager = new WaveManager();

        // 엔티티
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = [];

        // UI
        this.selectedTowerType = null;
        this.hoveredTower = null;
        this.ghostTower = null;
        this.draggedTower = null; // 드래그 중인 타워
        this.dragStartPos = null; // 드래그 시작 위치
        this.mergeTargetTower = null; // 합치기 대상 타워

        // 타워 비용
        this.towerCosts = {
            archer: 50,
            machinegun: 100,
            bomb: 150,
            laser: 200
        };

        // 타이밍
        this.lastTime = 0;
        this.animationId = null;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.pathSystem = new PathSystem(this.displayWidth, this.displayHeight);
        this.render();
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // 표시 크기 설정
        const displayWidth = Math.floor(rect.width);
        const displayHeight = Math.floor(rect.height);

        // Retina 지원을 위한 실제 캔버스 크기
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;

        // CSS 크기는 표시 크기로
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';

        // 컨텍스트 스케일 설정
        this.ctx.scale(dpr, dpr);

        // 게임 로직은 표시 크기 사용
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
    }

    setupEventListeners() {
        // 윈도우 리사이즈
        window.addEventListener('resize', () => {
            this.setupCanvas();
            if (this.pathSystem) {
                this.pathSystem.resize(this.displayWidth, this.displayHeight);
            }
        });

        // 타워 선택 버튼
        document.querySelectorAll('.tower-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const towerType = btn.dataset.tower;
                const cost = parseInt(btn.dataset.cost);

                if (this.gold >= cost) {
                    this.selectTower(towerType);

                    // UI 업데이트
                    document.querySelectorAll('.tower-button').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                }
            });
        });

        // 캔버스 마우스 다운 (타워 배치 또는 드래그 시작)
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.state !== 'playing' && this.state !== 'paused') return;

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // 타워 선택 중이면 배치
            if (this.selectedTowerType) {
                this.placeTower(x, y);
                return;
            }

            // 기존 타워 클릭 시 드래그 시작
            const clickedTower = this.getTowerAtPosition(x, y);
            if (clickedTower) {
                this.draggedTower = clickedTower;
                this.dragStartPos = { x: clickedTower.x, y: clickedTower.y };
            }
        });

        // 캔버스 마우스 이동 (고스트 타워 또는 드래그)
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // 타워 선택 중이면 고스트 타워 표시
            if (this.selectedTowerType) {
                this.ghostTower = { x, y, type: this.selectedTowerType };
                return;
            }

            // 타워 드래그 중
            if (this.draggedTower) {
                this.draggedTower.x = x;
                this.draggedTower.y = y;

                // 합칠 수 있는 타워 찾기
                this.mergeTargetTower = this.findMergeableTower(this.draggedTower, x, y);
            }
        });

        // 캔버스 마우스 업 (드래그 종료)
        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.draggedTower) return;

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // 합칠 수 있는 타워가 있으면 합치기
            if (this.mergeTargetTower) {
                this.mergeTowers(this.draggedTower, this.mergeTargetTower);
            } else {
                // 원래 위치로 되돌리기
                this.draggedTower.x = this.dragStartPos.x;
                this.draggedTower.y = this.dragStartPos.y;
            }

            this.draggedTower = null;
            this.dragStartPos = null;
            this.mergeTargetTower = null;
        });

        // 터치 이벤트 (모바일 지원)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.state !== 'playing' && this.state !== 'paused') return;

            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            if (this.selectedTowerType) {
                this.placeTower(x, y);
            } else {
                // 기존 타워 터치 시 드래그 시작
                const clickedTower = this.getTowerAtPosition(x, y);
                if (clickedTower) {
                    this.draggedTower = clickedTower;
                    this.dragStartPos = { x: clickedTower.x, y: clickedTower.y };
                }
            }
        }, { passive: false });

        // 터치 이동 (고스트 타워 또는 드래그)
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();

            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            if (this.selectedTowerType) {
                this.ghostTower = { x, y, type: this.selectedTowerType };
            } else if (this.draggedTower) {
                this.draggedTower.x = x;
                this.draggedTower.y = y;

                // 합칠 수 있는 타워 찾기
                this.mergeTargetTower = this.findMergeableTower(this.draggedTower, x, y);
            }
        }, { passive: false });

        // 터치 종료 (드래그 종료)
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();

            if (this.draggedTower) {
                // 합칠 수 있는 타워가 있으면 합치기
                if (this.mergeTargetTower) {
                    this.mergeTowers(this.draggedTower, this.mergeTargetTower);
                } else {
                    // 원래 위치로 되돌리기
                    this.draggedTower.x = this.dragStartPos.x;
                    this.draggedTower.y = this.dragStartPos.y;
                }

                this.draggedTower = null;
                this.dragStartPos = null;
                this.mergeTargetTower = null;
            }
        }, { passive: false });

        // 컨트롤 버튼
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('nextWaveBtn').addEventListener('click', () => this.startNextWave());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restart());
    }

    selectTower(type) {
        this.selectedTowerType = type;

        const info = document.getElementById('selectedTowerInfo');
        const cost = this.towerCosts[type];
        info.innerHTML = `<p><strong>${type}</strong> 선택됨 (💰 ${cost})</p><p>맵에 클릭하여 배치하세요</p>`;
    }

    getTowerAtPosition(x, y) {
        const clickRadius = 30; // 클릭 감지 반경

        for (const tower of this.towers) {
            const dx = tower.x - x;
            const dy = tower.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < clickRadius) {
                return tower;
            }
        }

        return null;
    }

    findMergeableTower(draggedTower, x, y) {
        const mergeRadius = 35; // 합치기 감지 반경

        for (const tower of this.towers) {
            if (tower === draggedTower) continue;

            const dx = tower.x - x;
            const dy = tower.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 같은 타입, 같은 레벨만 합칠 수 있음
            if (distance < mergeRadius &&
                tower.type === draggedTower.type &&
                tower.level === draggedTower.level) {
                return tower;
            }
        }

        return null;
    }

    mergeTowers(tower1, tower2) {
        // tower2를 제거하고 tower1을 레벨업
        const index = this.towers.indexOf(tower1);
        if (index > -1) {
            this.towers.splice(index, 1);
        }

        // tower2의 위치에서 새로운 레벨의 타워 생성
        const newLevel = tower2.level + 1;
        const newTower = new Tower(tower2.type, tower2.x, tower2.y, newLevel);

        // tower2를 newTower로 교체
        const index2 = this.towers.indexOf(tower2);
        if (index2 > -1) {
            this.towers[index2] = newTower;
        }

        // 파티클 이펙트
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(tower2.x, tower2.y, 'hit'));
        }
    }

    placeTower(x, y) {
        if (!this.selectedTowerType) return;

        const cost = this.towerCosts[this.selectedTowerType];

        // 골드 체크
        if (this.gold < cost) {
            return;
        }

        // 경로 위인지 체크
        if (this.pathSystem.isOnPath(x, y)) {
            return;
        }

        // 다른 타워와 겹치는지 체크
        const minDistance = 40;
        for (const tower of this.towers) {
            const dx = tower.x - x;
            const dy = tower.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
                return;
            }
        }

        // 타워 배치
        this.towers.push(new Tower(this.selectedTowerType, x, y));
        this.gold -= cost;
        this.updateUI();

        // 선택 해제
        this.selectedTowerType = null;
        this.ghostTower = null;
        document.querySelectorAll('.tower-button').forEach(b => b.classList.remove('selected'));

        const info = document.getElementById('selectedTowerInfo');
        info.innerHTML = '<p>타워를 선택하고 맵에 배치하세요</p>';
    }

    startGame() {
        this.state = 'playing';
        this.waveManager.startWave();
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);

        // UI 업데이트
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('nextWaveBtn').disabled = true;
    }

    startNextWave() {
        if (this.waveManager.canStartNextWave()) {
            this.waveManager.startWave();
            document.getElementById('nextWaveBtn').disabled = true;
        }
    }

    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            document.getElementById('pauseBtn').textContent = '▶️ 계속';
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.lastTime = performance.now();
            this.gameLoop(this.lastTime);
            document.getElementById('pauseBtn').textContent = '⏸️ 일시정지';
        }
    }

    restart() {
        // 상태 초기화
        this.state = 'menu';
        this.gold = 200;
        this.lives = 20;
        this.score = 0;

        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = [];

        this.selectedTowerType = null;
        this.ghostTower = null;

        this.waveManager.reset();

        // UI 초기화
        document.getElementById('gameOverModal').classList.remove('active');
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('nextWaveBtn').disabled = true;

        this.updateUI();
        this.render();
    }

    gameLoop(currentTime) {
        if (this.state !== 'playing') return;

        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();

        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        // 웨이브 업데이트
        const bonusGold = this.waveManager.update(deltaTime, this.enemies, this.pathSystem);
        if (bonusGold !== null) {
            this.gold += bonusGold;
            this.score += bonusGold;

            // 다음 웨이브 버튼 활성화
            if (this.waveManager.canStartNextWave()) {
                document.getElementById('nextWaveBtn').disabled = false;
            } else if (this.waveManager.allWavesCompleted) {
                this.victory();
                return;
            }
        }

        // 적 업데이트
        for (const enemy of this.enemies) {
            enemy.update(deltaTime);

            // 골인 체크
            if (enemy.reachedEnd && enemy.alive) {
                this.lives--;
                enemy.alive = false;

                if (this.lives <= 0) {
                    this.gameOver();
                    return;
                }
            }

            // 죽은 적 골드 획득 (한 번만)
            if (!enemy.alive && enemy.hp === 0 && !enemy.goldAwarded) {
                this.gold += enemy.gold;
                this.score += enemy.gold * 2;
                enemy.goldAwarded = true;
            }
        }

        // 죽은 적 또는 골인한 적 제거
        this.enemies = this.enemies.filter(e => e.alive);

        // 타워 업데이트
        for (const tower of this.towers) {
            tower.update(deltaTime, this.enemies, this.projectiles, this.particles);
        }

        // 발사체 업데이트
        for (const projectile of this.projectiles) {
            projectile.update(deltaTime, this.enemies, this.particles);
        }
        this.projectiles = this.projectiles.filter(p => p.alive);

        // 파티클 업데이트
        for (const particle of this.particles) {
            particle.update(deltaTime);
        }
        this.particles = this.particles.filter(p => p.alive);

        // UI 업데이트
        this.updateUI();
    }

    render() {
        // 배경
        this.ctx.fillStyle = '#141933';
        this.ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

        // 경로
        if (this.pathSystem) {
            this.pathSystem.render(this.ctx);
        }

        // 타워 배치 그리드 (게임 플레이 중에만 표시)
        if (this.state === 'playing' || this.state === 'paused') {
            this.renderPlacementGrid();
        }

        // 타워 (사거리 먼저)
        for (const tower of this.towers) {
            if (this.hoveredTower === tower) {
                tower.renderRange(this.ctx);
            }
        }

        // 고스트 타워
        if (this.ghostTower && this.selectedTowerType) {
            const canPlace = !this.pathSystem.isOnPath(this.ghostTower.x, this.ghostTower.y);

            this.ctx.globalAlpha = 0.5;
            const ghostStats = {
                archer: { emoji: '🏹', range: 150 },
                machinegun: { emoji: '🔫', range: 100 },
                bomb: { emoji: '💣', range: 140 },
                laser: { emoji: '⚡', range: 200 }
            };

            const stat = ghostStats[this.ghostTower.type];

            // 사거리
            this.ctx.strokeStyle = canPlace ? 'rgba(0, 212, 255, 0.5)' : 'rgba(255, 51, 102, 0.5)';
            this.ctx.fillStyle = canPlace ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 51, 102, 0.1)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.ghostTower.x, this.ghostTower.y, stat.range, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // 이모지
            this.ctx.font = '28px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(stat.emoji, this.ghostTower.x, this.ghostTower.y);

            this.ctx.globalAlpha = 1;
        }

        // 파티클
        for (const particle of this.particles) {
            particle.render(this.ctx);
        }

        // 발사체
        for (const projectile of this.projectiles) {
            projectile.render(this.ctx);
        }

        // 타워
        for (const tower of this.towers) {
            tower.render(this.ctx);
        }

        // 적
        for (const enemy of this.enemies) {
            enemy.render(this.ctx);
        }

        // 메뉴 상태
        if (this.state === 'menu') {
            this.ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
            this.ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🎮 이모지 디펜스', this.displayWidth / 2, this.displayHeight / 2 - 40);

            this.ctx.font = '24px Arial';
            this.ctx.fillText('시작 버튼을 눌러주세요', this.displayWidth / 2, this.displayHeight / 2 + 20);
        }
    }

    renderPlacementGrid() {
        const gridSize = 40; // 그리드 간격
        const dotRadius = 2; // 점 크기

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';

        // 그리드 점 그리기
        for (let x = gridSize; x < this.displayWidth; x += gridSize) {
            for (let y = gridSize; y < this.displayHeight; y += gridSize) {
                // 경로 위가 아닌 곳만 그리드 표시
                if (!this.pathSystem.isOnPath(x, y)) {
                    // 다른 타워와 겹치는지 확인
                    let canPlace = true;
                    const minDistance = 35;
                    for (const tower of this.towers) {
                        const dx = tower.x - x;
                        const dy = tower.y - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < minDistance) {
                            canPlace = false;
                            break;
                        }
                    }

                    if (canPlace) {
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }
            }
        }
    }

    updateUI() {
        document.getElementById('goldDisplay').textContent = this.gold;
        document.getElementById('livesDisplay').textContent = this.lives;
        document.getElementById('waveDisplay').textContent =
            `${this.waveManager.currentWave} / ${this.waveManager.totalWaves}`;

        // 타워 버튼 활성화/비활성화
        document.querySelectorAll('.tower-button').forEach(btn => {
            const cost = parseInt(btn.dataset.cost);
            if (this.gold < cost) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
        });
    }

    gameOver() {
        this.state = 'gameover';

        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const stats = document.getElementById('finalStats');

        title.textContent = '💀 게임 오버';
        message.textContent = '적들이 목표 지점에 도달했습니다!';
        stats.innerHTML = `
            <p><strong>도달한 웨이브:</strong> ${this.waveManager.currentWave} / ${this.waveManager.totalWaves}</p>
            <p><strong>최종 점수:</strong> ${this.score}</p>
        `;

        modal.classList.add('active');
    }

    victory() {
        this.state = 'victory';

        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const stats = document.getElementById('finalStats');

        title.textContent = '🎉 승리!';
        message.textContent = '모든 웨이브를 클리어했습니다!';
        stats.innerHTML = `
            <p><strong>남은 생명력:</strong> ${this.lives}</p>
            <p><strong>최종 점수:</strong> ${this.score}</p>
            <p><strong>⭐ 완벽한 방어! ⭐</strong></p>
        `;

        modal.classList.add('active');
    }
}

// 게임 시작
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new Game();
});
