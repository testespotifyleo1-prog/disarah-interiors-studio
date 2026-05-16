import { useSiteSettings } from '@/hooks/useSiteSettings';

export function WhatsAppFloat() {
  const { data: s } = useSiteSettings();
  const num = (s?.whatsapp_number || '').replace(/\D/g, '');
  if (!num) return null;
  const msg = encodeURIComponent(s?.whatsapp_message || 'Olá!');
  const href = `https://wa.me/${num}?text=${msg}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 group"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
      <span className="relative flex items-center justify-center h-16 w-16 rounded-full bg-[#25D366] shadow-2xl hover:scale-110 transition-transform duration-300 ring-4 ring-white/30">
        <svg viewBox="0 0 32 32" className="h-9 w-9 fill-white" aria-hidden="true">
          <path d="M19.11 17.27c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.02-.22-.53-.45-.46-.61-.47l-.52-.01c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.97 2.63 1.11 2.81.14.18 1.91 2.92 4.63 4.09.65.28 1.15.45 1.55.57.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.83-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32zM16.02 4C9.39 4 4 9.4 4 16.04c0 2.12.55 4.19 1.6 6.01L4 28l6.1-1.6c1.77.97 3.76 1.48 5.92 1.48 6.63 0 12.02-5.4 12.02-12.04C28.04 9.4 22.65 4 16.02 4zm0 21.97c-1.92 0-3.81-.52-5.45-1.49l-.39-.23-3.62.95.97-3.53-.25-.4a9.97 9.97 0 0 1-1.55-5.27c0-5.51 4.49-9.99 10.01-9.99 5.52 0 10.01 4.48 10.01 9.99 0 5.51-4.49 9.97-10.01 9.97z"/>
        </svg>
      </span>
    </a>
  );
}
