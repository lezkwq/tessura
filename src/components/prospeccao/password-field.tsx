import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

export function PasswordField({ label = 'Senha', autoComplete = 'current-password' }: { label?: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return <div>
    <label htmlFor="password" className="field-label">{label}</label>
    <div className="relative">
      <input id="password" className="field pr-14" type={visible ? 'text' : 'password'} name="password" autoComplete={autoComplete} minLength={8} required placeholder={label} />
      <Button type="button" variant="quiet" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 [&_svg]:size-5" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}>
        {visible ? <EyeSlash weight="light" size={20} /> : <Eye weight="light" size={20} />}
      </Button>
    </div>
  </div>;
}