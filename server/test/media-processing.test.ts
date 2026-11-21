import sharp from 'sharp';
import {describe,expect,it} from 'vitest';
import {processImageBuffer} from '../src/modules/media/processing.js';

describe('photo processing',()=>{
  it('creates four WebP variants and strips GPS EXIF',async()=>{
    const source=await sharp({create:{width:1200,height:800,channels:3,background:'#e0102d'}})
      .jpeg()
      .withExif({IFD3:{GPSLatitudeRef:'N',GPSLatitude:'6/1 18/1 0/1',GPSLongitudeRef:'W',GPSLongitude:'10/1 48/1 0/1'}})
      .toBuffer();
    expect((await sharp(source).metadata()).exif).toBeDefined();
    const result=await processImageBuffer(source);
    expect(Object.keys(result.variants).sort()).toEqual(['blur','lg','md','sm']);
    expect(result.blurhash.length).toBeGreaterThan(10);
    for(const image of Object.values(result.variants)){
      const metadata=await sharp(image).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
    }
  });
});
