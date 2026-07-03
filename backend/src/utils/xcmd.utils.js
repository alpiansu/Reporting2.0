import { spawn } from 'child_process';

function formatYYMMDD(dateStr) {
  const d = new Date(dateStr);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export function buildDthrFilename({ kdtk, tglTransaksi }) {
  const prefixMap = { T: 'H', F: 'F', R: 'C' };
  const firstChar = kdtk.charAt(0).toUpperCase();
  const prefix = prefixMap[firstChar];

  if (!prefix) {
    throw new Error(`Kode toko awalan tidak dikenal untuk mapping dthr: ${kdtk}`);
  }

  const last3 = kdtk.slice(-3);
  const yymmdd = formatYYMMDD(tglTransaksi);
  return `${prefix}R${yymmdd}.${last3}`;
}

export function runXcmd(commandArgs, { cwd, timeoutMs = 60_000 } = {}) {
  if (!cwd) {
    throw new Error('runXcmd wajib menerima opsi cwd secara eksplisit');
  }

  return new Promise((resolve, reject) => {
    const child = spawn('xcmd', commandArgs, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`xcmd timeout setelah ${timeoutMs}ms: ${commandArgs.join(' ')}`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`xcmd exit code ${code}: ${stderr || stdout}`));
      }
      resolve({ stdout, stderr });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
