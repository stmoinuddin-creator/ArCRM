'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type BundleSectionId = 'flows' | 'automations' | 'quick_replies' | 'templates' | 'ai';

interface SectionResult {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

/**
 * "Import JSON" / "Export JSON" pair for one part of the setup. It talks to
 * the same endpoints as Settings → Import / export, limited to one section.
 *
 * The file may be a full bundle (only this section is applied) or a bare
 * array of this section's items.
 */
export function SectionBundleActions({
  section,
  label,
  onDone,
}: {
  section: BundleSectionId;
  /** Plural noun for tooltips, e.g. "automations". */
  label: string;
  /** Called after a successful import; defaults to a page reload. */
  onDone?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      let doc: unknown;
      try {
        doc = JSON.parse(await file.text());
      } catch {
        toast.error("That file isn't valid JSON.");
        return;
      }
      const bundle = Array.isArray(doc) ? { [section]: doc } : doc;
      const res = await fetch('/api/workspace/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle, sections: [section] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.details) ? ` ${data.details.slice(0, 3).join(' ')}` : '';
        toast.error((data.error ?? 'Import failed.') + detail);
        return;
      }
      const r = (data.results?.[section] ?? null) as SectionResult | null;
      if (!r) {
        toast.warning(`The file has no ${label} to import.`);
        return;
      }
      toast.success(`Imported: ${r.created} new, ${r.updated} updated, ${r.skipped} skipped.`);
      if (r.warnings.length > 0) toast.warning(r.warnings.slice(0, 3).join(' '));
      if (onDone) onDone();
      else window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('Import failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title={`Import ${label} from a JSON file`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Import JSON
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button
        variant="outline"
        render={<a href={`/api/workspace/export?sections=${section}`} download />}
        title={`Download your ${label} as a JSON file`}
      >
        <Download className="h-4 w-4" />
        Export JSON
      </Button>
    </div>
  );
}
