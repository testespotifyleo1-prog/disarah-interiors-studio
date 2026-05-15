import { SVGProps } from 'react';

/**
 * Ícone do WhatsApp no estilo Lucide (stroke, currentColor).
 * Mantém a paleta semântica do sistema — herda a cor do contexto.
 */
export function WhatsAppIcon({
  size = 24,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Balão arredondado com "rabicho" no canto inferior esquerdo */}
      <path d="M21 11.5a8.38 8.38 0 0 1-1.26 4.41 8.5 8.5 0 0 1-7.24 4.09 8.38 8.38 0 0 1-4.01-1L3 21l2.05-5.39A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 8.5-8.5A8.5 8.5 0 0 1 21 11.5z" />
      {/* Aro do telefone (handset) estilizado */}
      <path d="M9.5 8.5c0 3.5 2.5 6 6 6 .35 0 .67-.18.85-.48l.6-1a1 1 0 0 0-.34-1.36l-1.4-.84a1 1 0 0 0-1.18.14l-.4.4a4.5 4.5 0 0 1-2.5-2.5l.4-.4a1 1 0 0 0 .14-1.18l-.84-1.4A1 1 0 0 0 9.47 5.5l-1 .6c-.3.18-.48.5-.48.85z" />
    </svg>
  );
}

export default WhatsAppIcon;
