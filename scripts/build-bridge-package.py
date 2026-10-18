"""Build a reproducible, credential-free Windows PC bridge download."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = (
    'START_NAVER_BRIDGE.cmd', 'SETUP_NAVER_BRIDGE.cmd', 'README.md',
    'package.json', 'package-lock.json', 'config.example.json', 'config-check.js',
    'bridge.js', 'app-delivery.js', 'auto-fields.js', 'booking-reader.js', 'local-export.js', 'config.js', 'dom-reader.js',
    'preflight.js', 'picker.js', 'setup.js', 'setup.html', 'setup.css', 'setup-client.js', 'diagnose.js',
)

def build():
    destination = ROOT / 'downloads' / 'ludia-naver-bridge-0.5.0.zip'
    destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            source = ROOT / 'bridge' / name
            content = source.read_bytes()
            if name.endswith('.cmd'):
                content = content.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
            entry = zipfile.ZipInfo('LUDIA_Naver_Bridge/' + name, (2026, 10, 17, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.sha256').write_text(digest + '  ' + destination.name + '\n', encoding='utf-8')
    print(f'{destination.name}: {destination.stat().st_size} bytes, {len(FILES)} source files, no live config or profiles')
    return destination

if __name__ == '__main__':
    build()
