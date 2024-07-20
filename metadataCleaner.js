const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const path = require('path');
const fs = require('fs');

async function metadataCleaner(reels) {
  const cleanedReels = [];

  for (const reel of reels) {
    const outputFilePath = path.resolve(__dirname, 'cleaned', `cleaned-${path.basename(reel)}`);
    await new Promise((resolve, reject) => {
      ffmpeg(reel)
        .outputOptions('-map_metadata -1')
        .outputOptions('-vf', 'eq=saturation=1.1')
        .outputOptions('-metadata', 'creation_time=')
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputFilePath);
    });
    cleanedReels.push(outputFilePath);

    // Update the MD5 hash
    const fileBuffer = fs.readFileSync(outputFilePath);
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    fs.writeFileSync(`${outputFilePath}.md5`, hash);
  }

  return cleanedReels;
}

module.exports = { metadataCleaner };
