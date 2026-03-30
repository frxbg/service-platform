import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  BarcodeFormat,
  ChecksumException,
  DecodeHintType,
  FormatException,
  NotFoundException,
} from '@zxing/library';

interface BarcodeScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
}

const supportedFormats: BarcodeFormat[] = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

function createReader() {
  return new BrowserMultiFormatReader(
    new Map([[DecodeHintType.POSSIBLE_FORMATS, supportedFormats]]),
  );
}

export default function BarcodeScannerDialog({
  open,
  onClose,
  onDetected,
}: BarcodeScannerDialogProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isDecodingImage, setIsDecodingImage] = useState(false);

  const mediaDevicesAvailable = useMemo(
    () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
    [],
  );
  const secureContext = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (window.isSecureContext ||
        ['localhost', '127.0.0.1'].includes(window.location.hostname)),
    [],
  );
  const liveCameraSupported = secureContext && mediaDevicesAvailable;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setManualCode('');
    setCameraError('');
    setIsDecodingImage(false);

    if (!liveCameraSupported) {
      return undefined;
    }

    let cancelled = false;

    const stopScanner = () => {
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
        scannerControlsRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startScanner = async () => {
      try {
        const reader = createReader();
        readerRef.current = reader;

        const controls = await reader.decodeFromConstraints(
          {
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          },
          videoRef.current ?? undefined,
          (result, error, activeControls) => {
            if (cancelled) {
              return;
            }

            const detectedValue = result?.getText()?.trim();
            if (detectedValue) {
              onDetected(detectedValue);
              activeControls.stop();
              scannerControlsRef.current = null;
              onClose();
              stopScanner();
            }
            if (
              error &&
              !(error instanceof NotFoundException) &&
              !(error instanceof ChecksumException) &&
              !(error instanceof FormatException)
            ) {
              setCameraError(t('barcode.cameraError'));
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
      } catch {
        setCameraError(t('barcode.cameraError'));
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
      readerRef.current = null;
    };
  }, [liveCameraSupported, onClose, onDetected, open, t]);

  const handleCapturedImage = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setCameraError('');
    setIsDecodingImage(true);

    const reader = readerRef.current ?? createReader();
    const objectUrl = URL.createObjectURL(file);

    try {
      const result = await reader.decodeFromImageUrl(objectUrl);
      const detectedValue = result.getText()?.trim();

      if (!detectedValue) {
        setCameraError(t('barcode.imageDecodeError'));
        return;
      }

      onDetected(detectedValue);
      onClose();
    } catch {
      setCameraError(t('barcode.imageDecodeError'));
    } finally {
      URL.revokeObjectURL(objectUrl);
      setIsDecodingImage(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('barcode.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('barcode.subtitle')}
          </Typography>

          {!secureContext ? (
            <Alert severity="info">{t('barcode.secureContextRequired')}</Alert>
          ) : null}

          {secureContext && !mediaDevicesAvailable ? (
            <Alert severity="info">{t('barcode.notSupported')}</Alert>
          ) : null}

          {cameraError ? <Alert severity="warning">{cameraError}</Alert> : null}

          {liveCameraSupported ? (
            <Box
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#020617',
                minHeight: 220,
              }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', minHeight: 220, objectFit: 'cover' }}
              />
            </Box>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleCapturedImage}
          />

          <Button
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDecodingImage}
          >
            {t('barcode.capturePhoto')}
          </Button>

          <TextField
            label={t('barcode.manualLabel')}
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={!manualCode.trim() || isDecodingImage}
          onClick={() => {
            onDetected(manualCode.trim());
            onClose();
          }}
        >
          {t('barcode.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
