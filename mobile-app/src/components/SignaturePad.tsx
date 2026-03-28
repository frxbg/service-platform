import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface SignaturePadProps {
  onChange: (value: { imageDataUrl: string | null; hasSignature: boolean }) => void;
}

export default function SignaturePad({ onChange }: SignaturePadProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasSignatureRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#0f172a';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPosition = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    const { x, y } = getPosition(event);
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    const { x, y } = getPosition(event);
    context.lineTo(x, y);
    context.stroke();
    if (!hasSignatureRef.current) {
      hasSignatureRef.current = true;
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    context.closePath();
    setIsDrawing(false);
    onChange({
      imageDataUrl: hasSignatureRef.current ? canvas.toDataURL('image/png') : null,
      hasSignature: hasSignatureRef.current,
    });
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    hasSignatureRef.current = false;
    setHasSignature(false);
    onChange({ imageDataUrl: null, hasSignature: false });
  };

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          border: '1px solid #cbd5e1',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#ffffff',
        }}
      >
        <canvas
          ref={canvasRef}
          width={520}
          height={220}
          style={{ width: '100%', height: 220, display: 'block', touchAction: 'none' }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </Box>
      <Button variant="text" onClick={clearSignature}>
        {t('common.clear')}
      </Button>
    </Stack>
  );
}
