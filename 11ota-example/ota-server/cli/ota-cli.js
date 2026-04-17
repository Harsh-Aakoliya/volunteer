#!/usr/bin/env node

const { Command } = require('commander');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const archiver = require('archiver');
const os = require('os');

const CONFIG_FILE = path.join(os.homedir(), '.otaconfig.json');

const program = new Command();
program.version('2.0.0').description('OTA CLI for Expo React Native');

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  }
  return {};
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getClient() {
  const cfg = loadConfig();
  if (!cfg.serverUrl || !cfg.apiKey) {
    console.error(chalk.red('❌ Not configured. Run: node cli/ota-cli.js configure'));
    process.exit(1);
  }
  return axios.create({
    baseURL: cfg.serverUrl,
    headers: { 'x-api-key': cfg.apiKey },
    maxContentLength: 500 * 1024 * 1024,
    maxBodyLength: 500 * 1024 * 1024,
  });
}

function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * Resolve the expo project directory
 * Validates it has package.json with expo dependency
 */
function resolveProjectDir(projectPath) {
  const resolved = path.resolve(projectPath);

  if (!fs.existsSync(resolved)) {
    console.error(chalk.red(`❌ Project directory not found: ${resolved}`));
    process.exit(1);
  }

  const pkgPath = path.join(resolved, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(chalk.red(`❌ No package.json found in: ${resolved}`));
    console.error(chalk.yellow('   Are you sure this is an Expo project?'));
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (!deps['expo']) {
    console.error(chalk.red(`❌ "expo" not found in dependencies of: ${resolved}`));
    console.error(chalk.yellow('   Run: cd ' + resolved + ' && npm install expo'));
    process.exit(1);
  }

  return resolved;
}

/**
 * Run a shell command safely with proper error handling
 */
function runCommand(cmd, cwd) {
  try {
    const result = execSync(cmd, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      shell: true,             // ← Force shell usage
      env: {
        ...process.env,
        PATH: process.env.PATH,
        HOME: os.homedir(),
      },
      timeout: 300000,         // 5 minute timeout
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message || 'Unknown error',
      status: error.status,
    };
  }
}

// ══════════════════════════════════════════
// CONFIGURE
// ══════════════════════════════════════════
program
  .command('configure')
  .description('Set server URL and API key')
  .option('-s, --server <url>', 'Server URL')
  .option('-k, --key <apiKey>', 'API Key')
  .action(async (opts) => {
    const cfg = loadConfig();

    if (opts.server) cfg.serverUrl = opts.server.replace(/\/$/, '');
    if (opts.key) cfg.apiKey = opts.key;

    if (!cfg.serverUrl || !cfg.apiKey) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const ask = (q) => new Promise((r) => rl.question(q, r));

      if (!cfg.serverUrl) {
        cfg.serverUrl = (
          await ask('Server URL (e.g. http://192.168.1.100:3000): ')
        ).replace(/\/$/, '');
      }
      if (!cfg.apiKey) {
        cfg.apiKey = await ask('API Key: ');
      }
      rl.close();
    }

    saveConfig(cfg);
    console.log(chalk.green('✅ Saved to ' + CONFIG_FILE));
  });

// ══════════════════════════════════════════
// REGISTER
// ══════════════════════════════════════════
program
  .command('register')
  .description('Register a new account')
  .requiredOption('-u, --username <name>', 'Username')
  .requiredOption('-e, --email <email>', 'Email')
  .requiredOption('-p, --password <pass>', 'Password')
  .action(async (opts) => {
    const cfg = loadConfig();
    if (!cfg.serverUrl) {
      console.error(chalk.red('Run "configure" first'));
      process.exit(1);
    }

    const spinner = ora('Registering...').start();
    try {
      const { data } = await axios.post(`${cfg.serverUrl}/api/auth/register`, {
        username: opts.username,
        email: opts.email,
        password: opts.password,
      });
      cfg.apiKey = data.data.user.apiKey;
      saveConfig(cfg);
      spinner.succeed(chalk.green('Registered!'));
      console.log(chalk.cyan(`  API Key: ${data.data.user.apiKey}`));
      console.log(
        chalk.yellow('  API Key saved to config automatically.')
      );
    } catch (e) {
      spinner.fail(
        chalk.red(e.response?.data?.error || e.message)
      );
    }
  });

// ══════════════════════════════════════════
// APP CREATE
// ══════════════════════════════════════════
program
  .command('app:create <name>')
  .description('Create a new app')
  .option('-s, --slug <slug>', 'App slug')
  .action(async (name, opts) => {
    const spinner = ora('Creating app...').start();
    try {
      const client = getClient();
      const { data } = await client.post('/api/apps', {
        name,
        slug: opts.slug,
      });
      spinner.succeed(chalk.green('App created!'));
      console.log(chalk.cyan(`  App Key:  ${data.data.app_key}`));
      console.log(chalk.cyan(`  Name:     ${data.data.name}`));
      console.log(
        chalk.yellow(
          '\n  ⚡ Use this app_key in your app.config.js and CLI commands!\n'
        )
      );
    } catch (e) {
      spinner.fail(
        chalk.red(e.response?.data?.error || e.message)
      );
    }
  });

// ══════════════════════════════════════════
// APP LIST
// ══════════════════════════════════════════
program
  .command('app:list')
  .description('List all apps')
  .action(async () => {
    try {
      const { data } = await getClient().get('/api/apps');
      const table = new Table({
        head: ['App Key', 'Name', 'Updates', 'Downloads'],
      });
      data.data.forEach((a) =>
        table.push([a.app_key, a.name, a.update_count, a.total_downloads])
      );
      console.log(table.toString());
    } catch (e) {
      console.error(
        chalk.red(e.response?.data?.error || e.message)
      );
    }
  });

// ══════════════════════════════════════════
// ⭐ RELEASE — The Main Command (FIXED)
// ══════════════════════════════════════════
program
  .command('release')
  .description('Export Expo bundle and push OTA update')
  .requiredOption('-a, --app <appKey>', 'App key')
  .requiredOption('-p, --platform <platform>', 'Platform (android / ios)')
  .requiredOption(
    '-r, --runtime <version>',
    'Runtime version (must match app.config runtimeVersion)'
  )
  .option('-d, --deployment <name>', 'Deployment', 'production')
  .option('--description <desc>', 'Release description', '')
  .option(
    '--project <path>',
    'Path to Expo project directory (required if not running from project root)',
  )
  .option(
    '--dist <path>',
    'Path to pre-exported dist/ folder (skip expo export step)'
  )
  .action(async (opts) => {
    let distDir = opts.dist;
    let zipPath = null;

    try {
      // ──────────────────────────────────────────────
      // Step 0: Determine the Expo project directory
      // ──────────────────────────────────────────────
      let projectDir;

      if (opts.dist) {
        // User provided pre-built dist, no project dir needed
        projectDir = null;
      } else if (opts.project) {
        // User explicitly specified project path
        projectDir = resolveProjectDir(opts.project);
      } else {
        // Try current directory
        const cwdPkg = path.join(process.cwd(), 'package.json');
        if (
          fs.existsSync(cwdPkg) &&
          JSON.parse(fs.readFileSync(cwdPkg, 'utf-8')).dependencies?.expo
        ) {
          projectDir = process.cwd();
        } else {
          console.error(
            chalk.red(
              '❌ Current directory is not an Expo project.'
            )
          );
          console.error('');
          console.error(
            chalk.yellow(
              '   Use --project to specify your Expo app directory:'
            )
          );
          console.error('');
          console.error(
            chalk.cyan(
              '   node cli/ota-cli.js release \\'
            )
          );
          console.error(
            chalk.cyan(
              '     -a YOUR_APP_KEY \\'
            )
          );
          console.error(
            chalk.cyan(
              '     -p android \\'
            )
          );
          console.error(
            chalk.cyan(
              '     -r 1.0.0 \\'
            )
          );
          console.error(
            chalk.cyan(
              '     --project ../react-native-ota-client'
            )
          );
          console.error('');
          console.error(
            chalk.yellow(
              '   Or run this command from inside your Expo project folder.'
            )
          );
          process.exit(1);
        }
      }

      if (projectDir) {
        console.log(
          chalk.blue(`📁 Expo project: ${projectDir}`)
        );
      }

      // ──────────────────────────────────────────────
      // Step 1: Run expo export (if no pre-built dist)
      // ──────────────────────────────────────────────
      if (!distDir) {
        const exportSpinner = ora(
          `Running: npx expo export --platform ${opts.platform}...`
        ).start();

        // First, clean any previous dist folder
        const prevDist = path.join(projectDir, 'dist');
        if (fs.existsSync(prevDist)) {
          fs.rmSync(prevDist, { recursive: true, force: true });
          exportSpinner.text = 'Cleaned previous dist/. Running expo export...';
        }

        const result = runCommand(
          `npx expo export --platform ${opts.platform}`,
          projectDir
        );

        if (!result.success) {
          exportSpinner.fail('Expo export failed');
          console.error('');
          console.error(chalk.red('Error output:'));
          console.error(chalk.red(result.error));
          if (result.output) {
            console.error(chalk.yellow('Stdout:'));
            console.error(result.output);
          }
          console.error('');
          console.error(chalk.yellow('Troubleshooting:'));
          console.error(
            chalk.yellow(
              '  1. cd ' + projectDir + ' && npx expo export --platform ' + opts.platform
            )
          );
          console.error(
            chalk.yellow(
              '  2. Make sure "expo" is installed: npm install expo'
            )
          );
          console.error(
            chalk.yellow(
              '  3. Make sure app.config.js / app.json is valid'
            )
          );
          process.exit(1);
        }

        distDir = path.join(projectDir, 'dist');
        exportSpinner.succeed('Expo export complete');
      }

      // ──────────────────────────────────────────────
      // Step 2: Validate the dist/ folder
      // ──────────────────────────────────────────────
      distDir = path.resolve(distDir);

      if (!fs.existsSync(distDir)) {
        console.error(
          chalk.red(`❌ dist/ folder not found: ${distDir}`)
        );
        process.exit(1);
      }

      const metadataPath = path.join(distDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        console.error(
          chalk.red(
            '❌ metadata.json not found in dist/ folder'
          )
        );
        console.error(
          chalk.yellow(
            '   Contents of dist/:'
          )
        );
        try {
          const files = fs.readdirSync(distDir);
          files.forEach((f) => console.error(chalk.yellow(`     ${f}`)));
        } catch (e) {
          /* ignore */
        }
        process.exit(1);
      }

      const metadata = JSON.parse(
        fs.readFileSync(metadataPath, 'utf-8')
      );

      if (!metadata.fileMetadata?.[opts.platform]) {
        console.error(
          chalk.red(
            `❌ No "${opts.platform}" metadata found in metadata.json`
          )
        );
        console.error(
          chalk.yellow(
            `   Available platforms: ${Object.keys(metadata.fileMetadata || {}).join(', ') || 'none'}`
          )
        );
        console.error(
          chalk.yellow(
            `   Did you export for the right platform?`
          )
        );
        process.exit(1);
      }

      const bundlePath =
        metadata.fileMetadata[opts.platform].bundle;
      const assetCount =
        metadata.fileMetadata[opts.platform].assets?.length || 0;

      console.log(chalk.blue(`  📦 Bundle: ${bundlePath}`));
      console.log(chalk.blue(`  🎨 Assets: ${assetCount} files`));

      // Verify bundle file actually exists
      const bundleFullPath = path.join(distDir, bundlePath);
      if (!fs.existsSync(bundleFullPath)) {
        console.error(
          chalk.red(
            `❌ Bundle file not found: ${bundleFullPath}`
          )
        );
        process.exit(1);
      }

      const bundleStats = fs.statSync(bundleFullPath);
      console.log(
        chalk.blue(
          `  📏 Bundle size: ${(bundleStats.size / 1024 / 1024).toFixed(2)} MB`
        )
      );

      // ──────────────────────────────────────────────
      // Step 3: Zip the dist folder
      // ──────────────────────────────────────────────
      const zipSpinner = ora('Creating ZIP archive...').start();
      zipPath = path.join(
        os.tmpdir(),
        `ota-expo-${Date.now()}.zip`
      );
      const zipSize = await zipDirectory(distDir, zipPath);
      zipSpinner.succeed(
        `ZIP created (${(zipSize / 1024 / 1024).toFixed(2)} MB)`
      );

      // ──────────────────────────────────────────────
      // Step 4: Upload to OTA server
      // ──────────────────────────────────────────────
      const uploadSpinner = ora(
        'Uploading to OTA server...'
      ).start();

      const form = new FormData();
      form.append('bundle', fs.createReadStream(zipPath), {
        filename: 'bundle.zip',
        contentType: 'application/zip',
      });
      form.append('appKey', opts.app);
      form.append('platform', opts.platform);
      form.append('runtimeVersion', opts.runtime);
      form.append('deployment', opts.deployment);
      form.append('description', opts.description);

      const client = getClient();
      const { data } = await client.post(
        '/api/releases/expo-upload',
        form,
        {
          headers: {
            ...form.getHeaders(),
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100
              );
              uploadSpinner.text = `Uploading to OTA server... ${pct}%`;
            }
          },
        }
      );

      uploadSpinner.succeed(
        chalk.green('🎉 Update released successfully!')
      );
      console.log('');
      console.log(
        chalk.cyan(
          `  Update ID:       ${data.data.updateId}`
        )
      );
      console.log(
        chalk.cyan(
          `  Platform:        ${data.data.platform}`
        )
      );
      console.log(
        chalk.cyan(
          `  Runtime Version: ${data.data.runtimeVersion}`
        )
      );
      console.log(
        chalk.cyan(
          `  Deployment:      ${data.data.deployment}`
        )
      );
      console.log(
        chalk.cyan(
          `  Bundle Size:     ${data.data.bundleSize}`
        )
      );
      console.log(
        chalk.cyan(
          `  Assets:          ${data.data.assetsCount}`
        )
      );
      console.log('');
      console.log(
        chalk.green(
          '  Devices will pick this up on next app launch! ✨'
        )
      );
      console.log('');
    } catch (e) {
      console.error('');
      console.error(
        chalk.red(
          `❌ Failed: ${e.response?.data?.error || e.message}`
        )
      );
      if (e.response?.data) {
        console.error(chalk.red(JSON.stringify(e.response.data, null, 2)));
      }
      process.exit(1);
    } finally {
      // Cleanup zip temp file
      if (zipPath && fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch (e) {
          /* ignore */
        }
      }
    }
  });

// ══════════════════════════════════════════
// LIST UPDATES
// ══════════════════════════════════════════
program
  .command('updates <appKey>')
  .description('List updates for an app')
  .option('-p, --platform <platform>', 'Filter platform')
  .action(async (appKey, opts) => {
    try {
      const params = opts.platform
        ? `?platform=${opts.platform}`
        : '';
      const { data } = await getClient().get(
        `/api/releases/${appKey}/updates${params}`
      );

      if (data.data.length === 0) {
        console.log(chalk.yellow('No updates found.'));
        return;
      }

      const table = new Table({
        head: [
          'Update ID',
          'Platform',
          'Runtime',
          'Deploy',
          'Size',
          'DLs',
          'Active',
          'Created',
        ],
      });

      data.data.forEach((u) => {
        table.push([
          u.update_id.substring(0, 12) + '...',
          u.platform,
          u.runtime_version,
          u.deployment,
          u.bundleSizeFormatted,
          u.download_count,
          u.isActive ? chalk.green('✓') : chalk.red('✗'),
          u.created_at,
        ]);
      });

      console.log(table.toString());
    } catch (e) {
      console.error(
        chalk.red(e.response?.data?.error || e.message)
      );
    }
  });

// ══════════════════════════════════════════
// ROLLBACK
// ══════════════════════════════════════════
program
  .command('rollback <updateId>')
  .description('Rollback an update (activate the previous one)')
  .action(async (updateId) => {
    const spinner = ora('Rolling back...').start();
    try {
      const { data } = await getClient().post(
        `/api/releases/${updateId}/rollback`
      );
      spinner.succeed(chalk.green(data.message));
    } catch (e) {
      spinner.fail(
        chalk.red(e.response?.data?.error || e.message)
      );
    }
  });

// ══════════════════════════════════════════
// STATS
// ══════════════════════════════════════════
program
  .command('stats <appKey>')
  .description('View update statistics')
  .action(async (appKey) => {
    try {
      const { data } = await getClient().get(
        `/api/expo/stats/${appKey}`
      );
      console.log(chalk.bold('\n📊 Update Statistics\n'));
      console.log(
        `  Total Updates:   ${data.data.totals.total_updates}`
      );
      console.log(
        `  Total Downloads: ${data.data.totals.total_downloads}`
      );
      console.log(
        `  Total Installs:  ${data.data.totals.total_installs}`
      );
      console.log(
        `  Total Failures:  ${data.data.totals.total_failures}`
      );
      console.log('');
    } catch (e) {
      console.error(
        chalk.red(e.response?.data?.error || e.message)
      );
    }
  });

program.parse(process.argv);