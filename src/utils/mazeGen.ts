export interface Maze {
  grid: number[][]; // 0: path, 1: wall
  width: number;
  height: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  possibleStarts: Array<{x: number, y: number}>;
}

export function generateMaze(width: number, height: number): Maze {
  // Ensure odd dimensions for walls
  const w = width % 2 === 0 ? width + 1 : width;
  const h = height % 2 === 0 ? height + 1 : height;
  const centerX = Math.floor(w / 2) % 2 === 0 ? Math.floor(w / 2) + 1 : Math.floor(w / 2);
  const centerY = Math.floor(h / 2) % 2 === 0 ? Math.floor(h / 2) + 1 : Math.floor(h / 2);

  // Generate 16 potential start points along the perimeter (odd coordinates)
  const perimeterPoints: Array<{x: number, y: number}> = [];
  for (let x = 1; x < w - 1; x += 2) {
    perimeterPoints.push({ x, y: 1 });
    perimeterPoints.push({ x, y: h - 2 });
  }
  for (let y = 3; y < h - 3; y += 2) { // Avoid double counting corners
    perimeterPoints.push({ x: 1, y });
    perimeterPoints.push({ x: w - 2, y });
  }

  // Pick 16 evenly distributed points
  const step = perimeterPoints.length / 16;
  const targetStarts = Array.from({ length: 16 }, (_, i) => perimeterPoints[Math.floor(i * step)]);

  function createMaze(): Maze {
    const grid = Array(h).fill(0).map(() => Array(w).fill(1));

    function walk(x: number, y: number) {
      grid[y][x] = 0;
      const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]].sort(() => Math.random() - 0.5);
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[ny][nx] === 1) {
          grid[y + dy / 2][x + dx / 2] = 0;
          walk(nx, ny);
        }
      }
    }

    walk(centerX, centerY);
    
    // Only open the absolute center cell to make the final approach more precise
    grid[centerY][centerX] = 0;

    return {
      grid,
      width: w,
      height: h,
      startX: 1,
      startY: 1,
      endX: centerX,
      endY: centerY,
      possibleStarts: targetStarts
    };
  }

  function getDistances(maze: Maze): Record<string, number> {
    const distances: Record<string, number> = {};
    const queue: Array<[number, number, number]> = [[maze.endX, maze.endY, 0]];
    const visited = new Set<string>();
    visited.add(`${maze.endX},${maze.endY}`);

    while (queue.length > 0) {
      const [x, y, dist] = queue.shift()!;
      distances[`${x},${y}`] = dist;
      const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < maze.width && ny >= 0 && ny < maze.height && maze.grid[ny][nx] === 0 && !visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny, dist + 1]);
        }
      }
    }
    return distances;
  }

  let attempts = 0;
  while (attempts < 30) {
    const maze = createMaze();
    const distances = getDistances(maze);
    const startDists = maze.possibleStarts.map(s => distances[`${s.x},${s.y}`] || Infinity);
    const min = Math.min(...startDists);
    const max = Math.max(...startDists);
    
    // Minimum complexity: The shortest path must be at least 1.5x the Manhattan distance
    const manhattanDist = (w / 2) + (h / 2);
    const isChallenging = min > manhattanDist * 1.5;
    
    // Fairness: Paths within 25% of each other
    if (max !== Infinity && (max - min) / max < 0.25 && isChallenging) {
      return maze;
    }
    attempts++;
  }
  return createMaze();
}
