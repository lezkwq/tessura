import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { printError } from '@/lib/print-upload';

interface PrintPickerProps { files: File[]; onChange: (files: File[]) => void; busy: boolean }
function Thumbnail({ file, remove }: { file: File; remove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return <li className="relative w-28">
    {url && <img src={url} alt={file.name} className="h-28 w-28 rounded-[28px] object-cover" />}
    <Button type="button" size="sm" variant="bordered" className="absolute right-1 top-1 h-8 w-8 p-0" aria-label={`Remover ${file.name}`} onClick={remove}>×</Button>
    <p className="mt-1 break-words text-xs text-muted-foreground">{file.name}</p>
  </li>;
}
export function PrintPicker({ files, onChange, busy }: PrintPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return <div className="mt-5">
    <label className="data-label block" htmlFor="prints">Prints do Instagram (opcional)</label>
    <input ref={input} id="prints" type="file" hidden accept="image/png,image/jpeg,image/webp" multiple onChange={e => {
      const incoming = Array.from(e.target.files ?? []); e.target.value = '';
      const invalid = incoming.map(printError).find(Boolean);
      if (invalid) { setError(invalid); return; }
      if (files.length + incoming.length > 5) { setError('Escolha até 5 prints por leitura.'); return; }
      setError(''); onChange([...files, ...incoming]);
    }} />
    <Button type="button" className="mt-3" variant="bordered" size="sm" disabled={busy} onClick={() => input.current?.click()}>Escolher prints</Button>
    <p className="mt-2 text-xs text-muted-foreground">Para ler a linguagem visual, envie também um print do feed, com as primeiras publicações.</p>
    {files.length > 0 && <ul className="mt-4 flex flex-wrap gap-3">{files.map((file, index) => <Thumbnail key={`${file.name}-${file.lastModified}-${index}`} file={file} remove={() => onChange(files.filter((_, i) => i !== index))} />)}</ul>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}