// Path System - 적의 이동 경로 및 타워 배치 가능 영역 관리

class PathSystem {
    constructor(canvasWidth, canvasHeight, scaleFactor = 1) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.scaleFactor = scaleFactor;
        this.pathWidth = 60 * scaleFactor;

        // 웨이포인트 정의 (화면 비율 기반) - 더 복잡한 경로
        this.waypoints = [
            { x: 0, y: 0.5 },           // 시작 (왼쪽 중앙)
            { x: 0.15, y: 0.5 },
            { x: 0.15, y: 0.15 },       // 위로
            { x: 0.35, y: 0.15 },       // 오른쪽
            { x: 0.35, y: 0.45 },       // 아래로
            { x: 0.2, y: 0.45 },        // 왼쪽으로 꺾임
            { x: 0.2, y: 0.75 },        // 다시 아래로
            { x: 0.5, y: 0.75 },        // 오른쪽
            { x: 0.5, y: 0.3 },         // 위로
            { x: 0.7, y: 0.3 },         // 오른쪽
            { x: 0.7, y: 0.6 },         // 아래로
            { x: 0.85, y: 0.6 },        // 오른쪽
            { x: 0.85, y: 0.2 },        // 위로
            { x: 1, y: 0.2 }            // 끝 (오른쪽 상단)
        ];

        this.pathSegments = [];
        this.calculatePathSegments();
    }

    // 절대 좌표로 변환
    getAbsoluteWaypoints() {
        return this.waypoints.map(wp => ({
            x: wp.x * this.canvasWidth,
            y: wp.y * this.canvasHeight
        }));
    }

    // 경로 세그먼트 계산
    calculatePathSegments() {
        const waypoints = this.getAbsoluteWaypoints();
        this.pathSegments = [];

        for (let i = 0; i < waypoints.length - 1; i++) {
            this.pathSegments.push({
                start: waypoints[i],
                end: waypoints[i + 1]
            });
        }
    }

    // 경로 렌더링
    render(ctx) {
        const waypoints = this.getAbsoluteWaypoints();

        // 경로 배경
        ctx.strokeStyle = 'rgba(100, 100, 120, 0.3)';
        ctx.lineWidth = this.pathWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
            ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();

        // 경로 테두리 (점선)
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);

        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
            ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 시작점 마커
        ctx.fillStyle = '#00ff88';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚪', waypoints[0].x, waypoints[0].y);

        // 끝점 마커
        ctx.fillStyle = '#ff3366';
        ctx.fillText('🏁', waypoints[waypoints.length - 1].x, waypoints[waypoints.length - 1].y);
    }

    // 특정 거리에서의 위치 계산 (0~1 사이의 progress)
    getPositionAtProgress(progress) {
        const waypoints = this.getAbsoluteWaypoints();

        // 전체 경로 길이 계산
        let totalLength = 0;
        const segmentLengths = [];

        for (let i = 0; i < waypoints.length - 1; i++) {
            const dx = waypoints[i + 1].x - waypoints[i].x;
            const dy = waypoints[i + 1].y - waypoints[i].y;
            const length = Math.sqrt(dx * dx + dy * dy);
            segmentLengths.push(length);
            totalLength += length;
        }

        // 목표 거리
        const targetDistance = progress * totalLength;

        // 어느 세그먼트에 있는지 찾기
        let accumulatedDistance = 0;
        for (let i = 0; i < segmentLengths.length; i++) {
            if (accumulatedDistance + segmentLengths[i] >= targetDistance) {
                // 현재 세그먼트 내에서의 위치
                const segmentProgress = (targetDistance - accumulatedDistance) / segmentLengths[i];

                return {
                    x: waypoints[i].x + (waypoints[i + 1].x - waypoints[i].x) * segmentProgress,
                    y: waypoints[i].y + (waypoints[i + 1].y - waypoints[i].y) * segmentProgress
                };
            }
            accumulatedDistance += segmentLengths[i];
        }

        // 끝에 도달
        return waypoints[waypoints.length - 1];
    }

    // 점이 경로 위에 있는지 확인
    isOnPath(x, y) {
        const waypoints = this.getAbsoluteWaypoints();

        for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i + 1];

            // 점과 선분 사이의 거리 계산
            const distance = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);

            if (distance < this.pathWidth / 2) {
                return true;
            }
        }

        return false;
    }

    // 점과 선분 사이의 거리
    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx === 0 && dy === 0) {
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }

        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    // 화면 크기 변경 시 재계산
    resize(canvasWidth, canvasHeight, scaleFactor = 1) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.scaleFactor = scaleFactor;
        this.pathWidth = 60 * scaleFactor;
        this.calculatePathSegments();
    }
}
