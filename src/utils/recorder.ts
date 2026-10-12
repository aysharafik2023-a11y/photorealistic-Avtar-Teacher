export class AvatarVideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;

  public startRecording(canvas: HTMLCanvasElement, audioCtx?: AudioContext | null): boolean {
    try {
      this.recordedChunks = [];
      const canvasStream = canvas.captureStream(60); // 60 FPS capture

      // If audio context is available, merge destination stream
      let combinedStream = canvasStream;
      if (audioCtx) {
        try {
          const dest = audioCtx.createMediaStreamDestination();
          // We can merge tracks if available
          const audioTracks = dest.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            combinedStream = new MediaStream([
              ...canvasStream.getVideoTracks(),
              ...audioTracks,
            ]);
          }
        } catch {
          combinedStream = canvasStream;
        }
      }

      // Check supported mime types
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000, // 6 Mbps high quality
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // 100ms slice
      this.isRecording = true;
      this.startTime = Date.now();
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      return false;
    }
  }

  public stopRecording(filename: string = 'avatar_lipsync_video.webm'): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.downloadBlob(blob, filename);
        this.isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }
}
