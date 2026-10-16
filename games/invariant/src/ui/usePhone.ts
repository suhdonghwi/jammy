import { useEffect, useState } from 'react';

// Below Tailwind's sm breakpoint the HUD is the phone layout (see also
// scene/PhoneFraming): for the few choices that need more than a class.
const PHONE = '(max-width: 639.98px)';

export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
