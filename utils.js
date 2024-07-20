const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const https = require('https');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(outputPath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
      }
    }).on('error', (err) => {
      reject(`Error downloading file: ${err.message}`);
    });
  });
}

const zipFiles = (filePaths, outputZipPath) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`${archive.pointer()} total bytes`);
      console.log('Archiver has been finalized and the output file descriptor has closed.');
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    filePaths.forEach((filePath) => {
      archive.file(filePath, { name: path.basename(filePath) });
    });

    archive.finalize();
  });
};

module.exports = { delay, downloadFile, zipFiles };