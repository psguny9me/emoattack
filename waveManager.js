// Wave Manager - 웨이브 시스템 관리

class WaveManager {
    constructor() {
        this.currentWave = 0;
        this.totalWaves = 10;
        this.enemiesSpawned = 0;
        this.enemiesInWave = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 1000; // ms
        this.waveInProgress = false;
        this.waveCompleted = false;
        this.allWavesCompleted = false;

        // 웨이브별 적 구성
        this.waveData = this.generateWaveData();
    }

    generateWaveData() {
        const waves = [];

        for (let i = 1; i <= this.totalWaves; i++) {
            const wave = {
                enemies: [],
                bonusGold: 10 + i * 5
            };

            // 기본 적들
            const antCount = Math.floor(3 + i * 1.5);
            const caterpillarCount = Math.floor(1 + i * 0.8);
            const scorpionCount = Math.floor(i > 2 ? 1 + i * 0.5 : 0);

            // 개미
            for (let j = 0; j < antCount; j++) {
                wave.enemies.push('ant');
            }

            // 애벌레
            for (let j = 0; j < caterpillarCount; j++) {
                wave.enemies.push('caterpillar');
            }

            // 전갈
            for (let j = 0; j < scorpionCount; j++) {
                wave.enemies.push('scorpion');
            }

            // 보스 웨이브 (5, 10)
            if (i === 5 || i === 10) {
                wave.enemies.push('dragon');
                if (i === 10) {
                    wave.enemies.push('dragon'); // 마지막 웨이브엔 드래곤 2마리
                }
            }

            // 섞기
            wave.enemies.sort(() => Math.random() - 0.5);

            waves.push(wave);
        }

        return waves;
    }

    startWave() {
        if (this.currentWave >= this.totalWaves) {
            this.allWavesCompleted = true;
            return;
        }

        this.currentWave++;
        this.enemiesSpawned = 0;
        this.spawnTimer = 0;
        this.waveInProgress = true;
        this.waveCompleted = false;

        const wave = this.waveData[this.currentWave - 1];
        this.enemiesInWave = wave.enemies.length;
    }

    update(deltaTime, enemies, pathSystem) {
        if (!this.waveInProgress) return null;

        const wave = this.waveData[this.currentWave - 1];

        // 적 스폰
        if (this.enemiesSpawned < this.enemiesInWave) {
            this.spawnTimer += deltaTime;

            if (this.spawnTimer >= this.spawnInterval) {
                const enemyType = wave.enemies[this.enemiesSpawned];
                const newEnemy = new Enemy(enemyType, pathSystem);

                // 웨이브에 따른 체력 스케일링 (웨이브마다 20%씩 증가)
                const hpMultiplier = 1 + (this.currentWave - 1) * 0.2;
                newEnemy.maxHp = Math.floor(newEnemy.maxHp * hpMultiplier);
                newEnemy.hp = newEnemy.maxHp;

                enemies.push(newEnemy);
                this.enemiesSpawned++;
                this.spawnTimer = 0;
            }
        }

        // 웨이브 완료 체크
        if (this.enemiesSpawned >= this.enemiesInWave) {
            // 모든 적이 죽었거나 골인했는지 확인
            const aliveEnemies = enemies.filter(e => e.alive && !e.reachedEnd).length;

            if (aliveEnemies === 0) {
                this.waveInProgress = false;
                this.waveCompleted = true;

                // 보너스 골드 반환
                return wave.bonusGold;
            }
        }

        return null;
    }

    isWaveComplete() {
        return this.waveCompleted;
    }

    canStartNextWave() {
        return !this.waveInProgress && this.currentWave < this.totalWaves;
    }

    reset() {
        this.currentWave = 0;
        this.enemiesSpawned = 0;
        this.enemiesInWave = 0;
        this.spawnTimer = 0;
        this.waveInProgress = false;
        this.waveCompleted = false;
        this.allWavesCompleted = false;
    }
}
