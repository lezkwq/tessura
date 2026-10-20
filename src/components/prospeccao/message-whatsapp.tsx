import { WhatsappLogo } from '@phosphor-icons/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { whatsappLink, whatsappNumber } from '@/lib/abordagem';
import { placeData } from '@/lib/prospeccao';
import { ActionIcon } from './action-icon';
export function MessageWhatsapp({ data, message }: { data: unknown; message: string }) {
  const d = placeData(data);
  const phone = whatsappNumber(d['phoneUnformatted'] ?? d['phone']);
  return phone.number
    ? <a className={buttonVariants({ variant: 'solid', className: 'h-auto py-1 pl-1 pr-4 whitespace-normal' })} href={whatsappLink(phone.number, message)} target="_blank" rel="noreferrer"><ActionIcon icon={WhatsappLogo}/>Abrir WhatsApp com a mensagem</a>
    : <div><Button variant="solid" disabled>Abrir WhatsApp com a mensagem</Button><p className="mt-2 text-xs text-muted-foreground">Sem telefone</p></div>;
}