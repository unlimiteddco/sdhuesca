import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_MEDIUM, canEncodeVideo } from 'mediabunny';
import type { CallUp } from './callup';

/** Vídeo para reels y stories: 1080×1920 a 30 fps */
export const VIDEO = { width: 1080, height: 1920, fps: 30 };

/**
 * Graba la convocatoria a MP4. Con WebCodecs (Chrome, Safari, Firefox recientes) se pinta fotograma a
 * fotograma, sin prisa: el vídeo sale fluido aunque el equipo sea lento. Sin WebCodecs se graba en tiempo real.
 */
export async function recordCallUp(callup: CallUp, onProgress: (done: number) => void): Promise<File> {
  const { width, height, fps } = VIDEO;
  callup.setSize(width, height);
  callup.restart();
  const frames = Math.ceil(callup.duration * fps);

  if (await canEncodeVideo('avc', { width, height, quality: QUALITY_MEDIUM, frameRate: fps })) {
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const source = new CanvasSource(callup.canvas, { codec: 'avc', quality: QUALITY_MEDIUM });
    output.addVideoTrack(source, { frameRate: fps });
    await output.start();
    for (let i = 0; i < frames; i++) {
      callup.advance(1 / fps);
      callup.draw();
      await source.add(i / fps, 1 / fps);
      if (i % 6 === 0) {
        onProgress(i / frames);
        await new Promise((r) => setTimeout(r));
      }
    }
    await output.finalize();
    onProgress(1);
    return new File([output.target.buffer!], 'convocatoria.mp4', { type: 'video/mp4' });
  }

  // plan B: grabar el lienzo mientras se reproduce
  const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t))!;
  const recorder = new MediaRecorder(callup.canvas.captureStream(fps), { mimeType: type, videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const stopped = new Promise((r) => (recorder.onstop = r));
  recorder.start();
  let last = performance.now();
  await new Promise<void>((done) => {
    const frame = () => {
      const now = performance.now();
      callup.advance(Math.min((now - last) / 1000, 1 / 15));
      last = now;
      callup.draw();
      onProgress(Math.min(1, callup.time / callup.duration));
      if (callup.time >= callup.duration) done();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  await stopped;
  const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
  return new File(chunks, `convocatoria.${ext}`, { type: type.split(';')[0] });
}
