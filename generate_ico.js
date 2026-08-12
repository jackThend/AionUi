/**
 * CriterioIA - Generate app.ico from logo.png
 * Uses sharp to resize + dynamic import for png-to-ico (ESM module).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

async function generate() {
    const sharp = require('sharp');
    // png-to-ico is ESM, so use dynamic import
    const pngToIcoModule = await import('png-to-ico');
    const pngToIco = pngToIcoModule.default || pngToIcoModule;

    const logoPath = path.join(__dirname, 'public', 'logo.png');
    const icoPath = path.join(__dirname, 'resources', 'app.ico');
    const tmpDir = os.tmpdir();

    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const tmpFiles = [];

    console.log('Resizing logo to ICO sizes...');
    for (const size of sizes) {
        const tmpFile = path.join(tmpDir, `criterio_logo_${size}.png`);
        await sharp(logoPath)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(tmpFile);
        tmpFiles.push(tmpFile);
        console.log(`  ✔ ${size}x${size}`);
    }

    console.log('Packing into ICO...');
    const icoBuffer = await pngToIco(tmpFiles);
    fs.writeFileSync(icoPath, icoBuffer);

    // Cleanup temp files
    tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch (_) { } });

    const stat = fs.statSync(icoPath);
    console.log(`✅ app.ico generated: ${(stat.size / 1024).toFixed(1)} KB at ${icoPath}`);
}

generate().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
