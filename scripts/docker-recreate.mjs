import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const imageName = process.env.DOCKER_IMAGE || 'projection-app:latest';
const containerName = process.env.DOCKER_CONTAINER || 'projection-app';
const containerPort = Number(process.env.PORT || 3000);
const hostPort = Number(process.env.DOCKER_HOST_PORT || containerPort);
const envFilePath = resolve(process.cwd(), '.env');
const dataDir = resolve(process.cwd(), 'data');

mkdirSync(dataDir, { recursive: true });

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    const joined = [command, ...args].join(' ');
    throw new Error(`Command failed: ${joined}`);
  }
};

const capture = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }
  return String(result.stdout || '').trim();
};

try {
  console.log(`Building Docker image ${imageName} ...`);
  run('docker', ['build', '-t', imageName, '.']);

  const existingName = capture('docker', [
    'ps',
    '-a',
    '--filter',
    `name=^/${containerName}$`,
    '--format',
    '{{.Names}}'
  ]);

  if (existingName === containerName) {
    console.log(`Removing existing container ${containerName} ...`);
    run('docker', ['rm', '-f', containerName]);
  }

  const runArgs = [
    'run',
    '-d',
    '--name',
    containerName,
    '--restart',
    'unless-stopped',
    '-p',
    `${hostPort}:${containerPort}`,
    '-v',
    `${dataDir}:/app/data`
  ];

  if (existsSync(envFilePath)) {
    runArgs.push('--env-file', envFilePath);
  } else {
    console.log('No .env file found. Starting container without --env-file.');
  }

  runArgs.push(imageName);

  console.log(`Starting container ${containerName} ...`);
  run('docker', runArgs);

  console.log(`Container ${containerName} is running.`);
  console.log(`SQLite data is persisted in host folder: ${dataDir}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
