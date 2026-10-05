// firebase-tools on Windows can leave its emulator JVMs running after `emulators:exec`,
// which blocks the next run ("port taken"). Stop any that are left over.
import { execFileSync } from 'node:child_process';

try {
  if (process.platform === 'win32') {
    const script =
      "Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" | " +
      "Where-Object { $_.CommandLine -like '*firebase*emulator*' } | " +
      'ForEach-Object { Stop-Process -Id $_.ProcessId -Force }';
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' });
  } else {
    execFileSync('pkill', ['-f', 'firebase.*emulator'], { stdio: 'ignore' });
  }
} catch {
  // Nothing was running (pkill exits non-zero in that case).
}
