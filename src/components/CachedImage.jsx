import { useState, useEffect, useRef } from 'react';
import { getCachedBlobUrl, cacheImage } from '../utils/imageCache';

// แสดงรูปจาก cache ก่อน ถ้าไม่มีค่อยดึงจาก URL แล้ว cache ไว้
export default function CachedImage({ src, style, onClick, alt = '' }) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!src || src.startsWith('data:')) {
      setDisplaySrc(src);
      return;
    }

    let cancelled = false;
    (async () => {
      const blobUrl = await getCachedBlobUrl(src);
      if (cancelled) return;
      if (blobUrl) {
        blobUrlRef.current = blobUrl;
        setDisplaySrc(blobUrl);
      } else {
        setDisplaySrc(src); // ใช้ URL ตรงไปก่อน
        cacheImage(src);    // cache ใน background
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src]);

  return <img src={displaySrc} alt={alt} style={style} onClick={onClick} />;
}
