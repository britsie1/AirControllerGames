export interface Maze {
  grid: number[][]; // 0: path, 1: wall
  width: number;
  height: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function generateMaze(width: number, height: number): Maze {
  // Ensure odd dimensions for walls
  const w = width % 2 === 0 ? width + 1 : width;
  const h = height % 2 === 0 ? height + 1 : height;
  
  const grid = Array(h).fill(0).map(() => Array(w).fill(1));

  function walk(x: number, y: number) {
    grid[y][x] = 0;

    const dirs = [
      [0, 2], [0, -2], [2, 0], [-2, 0]
    ].sort(() => Math.random() - 0.5);

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[ny][nx] === 1) {
        grid[y + dy / 2][x + dx / 2] = 0;
        walk(nx, ny);
      }
    }
  }

  // Start from a random edge point
  walk(1, 1);

  // Ensure center is open
  const centerX = Math.floor(w / 2);
  const centerY = Math.floor(h / 2);
  
  // Create a small 3x3 open area in the center
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      grid[centerY + dy][centerX + dx] = 0;
    }
  }

  return {
    grid,
    width: w,
    height: h,
    startX: 1,
    startY: 1,
    endX: centerX,
    endY: centerY
  };
}
