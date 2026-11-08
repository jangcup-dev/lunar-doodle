// 기기에 오래 남기기: 브라우저에 "공간이 부족해도 이 사이트 데이터는 지우지 말아 달라"고 요청하고, 백업 파일을 저장·공유한다.

/** 영구 보관 요청. 돌려줌: true(허용) / false(브라우저가 거절) / null(지원 안 함) */
export async function requestPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}
export async function isPersisted() {
  try { return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch { return null; }
}

export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * 휴대폰에서는 공유 창(카톡 나에게 보내기·파일 앱·드라이브에 저장)을, 컴퓨터에서는 다운로드를.
 * 돌려줌: 'shared' | 'downloaded' | 'cancelled'
 */
export async function saveFile(name, text, type, title) {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare) {
    try {
      const file = new File([text], name, { type });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  download(name, text, type);
  return 'downloaded';
}

export const DAY_MS = 86400000;
export function agoText(t) {
  if (!t) return '';
  const d = Math.floor((Date.now() - t) / DAY_MS);
  return d <= 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`;
}
