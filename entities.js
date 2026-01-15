// Entities - 게임 엔티티 클래스들 (Enemy, Tower, Projectile, Particle)

// ========== Enemy 클래스 ==========
class Enemy {
    constructor(type, pathSystem, scaleFactor = 1) {
        this.type = type;
        this.pathSystem = pathSystem;
        this.scaleFactor = scaleFactor;
        this.progress = 0; // 0~1 사이의 경로 진행도
        this.position = pathSystem.getPositionAtProgress(0);

        // 상단 생략 (stats)
        const stats = {
            ant: { emoji: '🐜', hp: 20, maxHp: 20, speed: 0.000075, gold: 3 },
            caterpillar: { emoji: '🐛', hp: 50, maxHp: 50, speed: 0.000045, gold: 6 },
            scorpion: { emoji: '🦂', hp: 80, maxHp: 80, speed: 0.00006, gold: 10 },
            dragon: { emoji: '🐉', hp: 250, maxHp: 250, speed: 0.000036, gold: 30 }
        };

        const stat = stats[type];
        this.emoji = stat.emoji;
        this.hp = stat.hp;
        this.maxHp = stat.maxHp;
        this.speed = stat.speed;
        this.gold = stat.gold;
        this.alive = true;
        this.reachedEnd = false;
        this.goldAwarded = false; // 중복 골드 획득 방지용
        this.size = 30 * scaleFactor;
    }

    update(deltaTime) {
        if (!this.alive || this.reachedEnd) return;

        // 경로를 따라 이동
        this.progress += this.speed * deltaTime;

        if (this.progress >= 1) {
            this.progress = 1;
            this.reachedEnd = true;
        }

        this.position = this.pathSystem.getPositionAtProgress(this.progress);
    }

    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
    }

    render(ctx) {
        if (!this.alive) return;

        // 이모지 렌더링
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.position.x, this.position.y);

        // HP 바
        const barWidth = 30 * this.scaleFactor;
        const barHeight = 4 * this.scaleFactor;
        const barX = this.position.x - barWidth / 2;
        const barY = this.position.y - this.size;

        // 배경
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // HP
        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = hpPercent > 0.5 ? '#00ff88' : hpPercent > 0.25 ? '#ffaa00' : '#ff3366';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    }
}

// ========== Tower 클래스 ==========
class Tower {
    constructor(type, x, y, level = 1, scaleFactor = 1) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.level = level;
        this.scaleFactor = scaleFactor;
        this.target = null;
        this.cooldown = 0;

        // 기본 타입별 스탯 (레벨 1)
        const baseStats = {
            archer: { emoji: '🏹', damage: 10, range: 150 * scaleFactor, fireRate: 1000, projectileSpeed: 0.3, aoe: 0 },
            machinegun: { emoji: '🔫', damage: 5, range: 100 * scaleFactor, fireRate: 300, projectileSpeed: 0.5, aoe: 0 },
            bomb: { emoji: '💣', damage: 30, range: 140 * scaleFactor, fireRate: 2000, projectileSpeed: 0.2, aoe: 50 * scaleFactor },
            laser: { emoji: '⚡', damage: 50, range: 200 * scaleFactor, fireRate: 1500, projectileSpeed: 0.8, aoe: 0 }
        };

        const baseStat = baseStats[type];
        this.emoji = baseStat.emoji;
        this.size = 28 * scaleFactor;

        // 레벨에 따른 스탯 계산
        this.calculateStats(baseStat);
    }

    calculateStats(baseStat) {
        // 타워 특성에 맞는 레벨업 보너스
        const levelBonus = this.level - 1;

        switch (this.type) {
            case 'archer':
                // 궁수: 사거리 +15%, 데미지 +20% per level
                this.damage = Math.floor(baseStat.damage * (1 + levelBonus * 0.2));
                this.range = Math.floor(baseStat.range * (1 + levelBonus * 0.15));
                this.fireRate = baseStat.fireRate;
                break;
            case 'machinegun':
                // 머신건: 연사력 +25%, 데미지 +15% per level
                this.damage = Math.floor(baseStat.damage * (1 + levelBonus * 0.15));
                this.range = baseStat.range;
                this.fireRate = Math.floor(baseStat.fireRate / (1 + levelBonus * 0.25));
                break;
            case 'bomb':
                // 폭탄: 데미지 +30%, 범위 +10% per level
                this.damage = Math.floor(baseStat.damage * (1 + levelBonus * 0.3));
                this.range = baseStat.range;
                this.fireRate = baseStat.fireRate;
                this.aoe = Math.floor(baseStat.aoe * (1 + levelBonus * 0.1));
                break;
            case 'laser':
                // 레이저: 데미지 +25%, 사거리 +10%, 연사력 +15% per level
                this.damage = Math.floor(baseStat.damage * (1 + levelBonus * 0.25));
                this.range = Math.floor(baseStat.range * (1 + levelBonus * 0.1));
                this.fireRate = Math.floor(baseStat.fireRate / (1 + levelBonus * 0.15));
                break;
        }

        this.projectileSpeed = baseStat.projectileSpeed;
        this.aoe = this.aoe || baseStat.aoe;
    }

    update(deltaTime, enemies, projectiles, particles) {
        // 쿨다운 감소
        if (this.cooldown > 0) {
            this.cooldown -= deltaTime;
        }

        // 타겟 찾기
        this.findTarget(enemies);

        // 공격
        if (this.target && this.cooldown <= 0) {
            this.fire(projectiles, particles);
            this.cooldown = this.fireRate;
        }
    }

    findTarget(enemies) {
        let closestEnemy = null;
        let maxProgress = -1;

        for (const enemy of enemies) {
            if (!enemy.alive || enemy.reachedEnd) continue;

            const dx = enemy.position.x - this.x;
            const dy = enemy.position.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= this.range && enemy.progress > maxProgress) {
                closestEnemy = enemy;
                maxProgress = enemy.progress;
            }
        }

        this.target = closestEnemy;
    }

    fire(projectiles, particles) {
        if (!this.target) return;

        if (this.type === 'laser') {
            // 레이저: 즉시 타격
            this.target.takeDamage(this.damage);

            // 히트 이펙트
            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(this.target.position.x, this.target.position.y, 'hit', this.scaleFactor));
            }

            // 레이저 빔 이펙트 (임시 발사체로 표시하거나 직접 그리기 위해 projectiles에 특수 타입 추가)
            projectiles.push(new Projectile(
                this.x, this.y, this.target, this.damage, this.projectileSpeed, this.aoe, this.type, false, this.scaleFactor
            ));
        } else {
            const isHoming = this.type === 'bomb';
            projectiles.push(new Projectile(
                this.x,
                this.y,
                this.target,
                this.damage,
                this.projectileSpeed,
                this.aoe,
                this.type,
                isHoming,
                this.scaleFactor
            ));
        }
    }

    render(ctx) {
        // 이모지 렌더링
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);

        // 레벨 표시 (2레벨 이상일 때)
        if (this.level > 1) {
            const levelBadgeSize = 16 * this.scaleFactor;
            const badgeX = this.x + 12 * this.scaleFactor;
            const badgeY = this.y - 12 * this.scaleFactor;

            // 배지 배경
            ctx.fillStyle = 'rgba(123, 47, 247, 0.9)';
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, levelBadgeSize / 2, 0, Math.PI * 2);
            ctx.fill();

            // 레벨 테두리
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2 * this.scaleFactor;
            ctx.stroke();

            // 레벨 텍스트
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.floor(10 * this.scaleFactor)}px Arial`;
            ctx.fillText(this.level.toString(), badgeX, badgeY);
        }

        // 타겟팅 라인
        if (this.target && this.target.alive) {
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.position.x, this.target.position.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    renderRange(ctx) {
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

// ========== Projectile 클래스 ==========
class Projectile {
    constructor(x, y, target, damage, speed, aoe, type, homing = true, scaleFactor = 1) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = speed;
        this.aoe = aoe;
        this.type = type;
        this.homing = homing;
        this.scaleFactor = scaleFactor;
        this.alive = true;
        this.size = 8 * scaleFactor;

        // 레이저인 경우 즉시 타격 처리용 수명
        if (type === 'laser') {
            this.lifetime = 100; // ms
            this.age = 0;
        }

        // 직선 발사를 위한 초기 방향 계산
        if (!this.homing && target) {
            const dx = target.position.x - x;
            const dy = target.position.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            this.vx = (dx / distance) * speed;
            this.vy = (dy / distance) * speed;
        }

        // 타입별 이모지
        const projectileEmojis = {
            archer: '➡️',
            machinegun: '💥',
            bomb: '💣',
            laser: '⚡'
        };
        this.emoji = projectileEmojis[type] || '•';
    }

    update(deltaTime, enemies, particles) {
        if (!this.alive) return;

        // 레이저 특수 처리 (그림 효과용)
        if (this.type === 'laser') {
            this.age += deltaTime;
            if (this.age >= this.lifetime) {
                this.alive = false;
            }
            return;
        }

        if (this.homing) {
            // 유도탄: 타겟 추적
            if (!this.target || !this.target.alive) {
                this.alive = false;
                return;
            }

            const dx = this.target.position.x - this.x;
            const dy = this.target.position.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 5) {
                this.hit(enemies, particles);
                this.alive = false;
            } else {
                const moveDistance = this.speed * deltaTime;
                this.x += (dx / distance) * moveDistance;
                this.y += (dy / distance) * moveDistance;
            }
        } else {
            // 직선탄: 초기 방향대로 이동
            this.x += this.vx * deltaTime;
            this.y += this.vy * deltaTime;

            // 화면 밖으로 나가면 제거
            if (this.x < 0 || this.x > 2000 || this.y < 0 || this.y > 2000) {
                this.alive = false;
                return;
            }

            // 충돌 체크 (모든 적 대상)
            for (const enemy of enemies) {
                if (!enemy.alive) continue;
                const dx = enemy.position.x - this.x;
                const dy = enemy.position.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 15 * this.scaleFactor) {
                    this.target = enemy; // 히트 시 타겟 설정
                    this.hit(enemies, particles);
                    this.alive = false;
                    break;
                }
            }
        }
    }

    hit(enemies, particles) {
        if (this.aoe > 0) {
            // 범위 데미지
            for (const enemy of enemies) {
                if (!enemy.alive) continue;

                const dx = enemy.position.x - this.x;
                const dy = enemy.position.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= this.aoe) {
                    enemy.takeDamage(this.damage);
                }
            }

            // 폭발 이펙트
            for (let i = 0; i < 12; i++) {
                particles.push(new Particle(this.x, this.y, 'explosion', this.scaleFactor));
            }
        } else {
            // 단일 타겟 데미지
            this.target.takeDamage(this.damage);

            // 히트 이펙트
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(this.target.position.x, this.target.position.y, 'hit', this.scaleFactor));
            }
        }
    }

    render(ctx) {
        if (!this.alive) return;

        if (this.type === 'laser') {
            // 레이저 빔 그리기
            if (this.target && this.target.alive) {
                const alpha = 1 - (this.age / this.lifetime);
                ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.target.position.x, this.target.position.y);
                ctx.stroke();
            }
        } else {
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.emoji, this.x, this.y);
        }
    }
}

// ========== Particle 클래스 ==========
class Particle {
    constructor(x, y, type, scaleFactor = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.scaleFactor = scaleFactor;
        this.lifetime = 500; // ms
        this.age = 0;
        this.alive = true;

        // 랜덤 속도
        const angle = Math.random() * Math.PI * 2;
        const speed = type === 'explosion' ? 0.2 + Math.random() * 0.2 : 0.1 + Math.random() * 0.1;
        this.vx = (Math.cos(angle) * speed);
        this.vy = (Math.sin(angle) * speed);

        // 색상
        this.color = type === 'explosion' ?
            `rgba(255, ${100 + Math.random() * 100}, 0, 1)` :
            `rgba(0, ${150 + Math.random() * 100}, 255, 1)`;
    }

    update(deltaTime) {
        this.age += deltaTime;
        if (this.age >= this.lifetime) {
            this.alive = false;
            return;
        }

        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    render(ctx) {
        if (!this.alive) return;

        const alpha = 1 - (this.age / this.lifetime);
        ctx.fillStyle = this.color.replace('1)', `${alpha})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3 * this.scaleFactor, 0, Math.PI * 2);
        ctx.fill();
    }
}
