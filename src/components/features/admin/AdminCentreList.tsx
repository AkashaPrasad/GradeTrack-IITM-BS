import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { AlertTriangle, Edit3, Plus, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import type { ExamCentre } from '@/lib/database.types';
import { useAdminExamCentres, useDeleteExamCentre, useSaveExamCentre } from '@/hooks/useExamCentres';

type CentreDraft = {
  id?: string;
  name: string;
  address: string;
  is_active: boolean;
  display_order: number;
};

const emptyDraft: CentreDraft = {
  name: '',
  address: '',
  is_active: true,
  display_order: 0,
};

function toDraft(centre?: ExamCentre | null): CentreDraft {
  if (!centre) return emptyDraft;
  return {
    id: centre.id,
    name: centre.name,
    address: centre.address,
    is_active: centre.is_active,
    display_order: centre.display_order,
  };
}

export function AdminCentreList() {
  const { data: centres = [], isLoading } = useAdminExamCentres();
  const saveCentre = useSaveExamCentre();
  const deleteCentre = useDeleteExamCentre();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CentreDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamCentre | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return centres;
    return centres.filter((centre) =>
      [centre.name, centre.address]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [centres, search]);

  const handleSave = async () => {
    if (!editing) return;
    await saveCentre.mutateAsync(editing);
    setEditing(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteCentre.mutateAsync(deleteTarget);
    setDeleteTarget(null);
  };

  const handleImport = async (file: File) => {
    const parsed = await new Promise<Array<Record<string, string>>>((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve(result.data),
        error: (error) => reject(error),
      });
    });

    for (const row of parsed) {
      if (!row.name || !row.address) continue;
      await saveCentre.mutateAsync({
        name: row.name,
        address: row.address,
        is_active: true,
        display_order: 0,
      });
    }
  };

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Manage Centre List</CardTitle>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImport(file);
                  e.currentTarget.value = '';
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </Button>
              <Button type="button" size="sm" onClick={() => setEditing(toDraft())}>
                <Plus className="h-3.5 w-3.5" />
                Add Centre
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fgmuted" />
              <Input
                placeholder="Search centres..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {editing && (
              <div className="rounded-lg border border-border bg-surface2/40 p-4 space-y-3">
                <div className="text-[13px] font-medium text-fg">
                  {editing.id ? 'Edit Centre' : 'Add New Centre'}
                </div>

                <div>
                  <Label>Centre Name</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. St. Xavier's College"
                    value={editing.name}
                    onChange={(e) => setEditing((d) => d ? { ...d, name: e.target.value } : d)}
                  />
                </div>

                <div>
                  <Label>Full Address</Label>
                  <Textarea
                    className="mt-1"
                    placeholder="Full address with landmark, area, city, state…"
                    rows={3}
                    value={editing.address}
                    onChange={(e) => setEditing((d) => d ? { ...d, address: e.target.value } : d)}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="w-28">
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      className="mt-1"
                      value={editing.display_order}
                      onChange={(e) => setEditing((d) => d ? { ...d, display_order: Number(e.target.value || 0) } : d)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm mt-5">
                    <Switch
                      checked={editing.is_active}
                      onCheckedChange={(v) => setEditing((d) => d ? { ...d, is_active: v } : d)}
                    />
                    Active
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={saveCentre.isPending}
                    disabled={!editing.name.trim() || !editing.address.trim()}
                    onClick={() => void handleSave()}
                  >
                    {editing.id ? 'Save Changes' : 'Add Centre'}
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="text-[13px] text-fgmuted py-4">Loading centres...</div>
            ) : filtered.length === 0 ? (
              <div className="text-[13px] text-fgmuted py-4">
                {search ? 'No centres match your search.' : 'No centres added yet.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((centre) => (
                  <div
                    key={centre.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[14px] font-medium">{centre.name}</div>
                        {!centre.is_active && (
                          <span className="text-[11px] text-warning">Inactive</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-fgmuted">
                        {centre.address}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(toDraft(centre))}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/10"
                        onClick={() => setDeleteTarget(centre)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-danger/15 grid place-items-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <DialogTitle>Delete exam centre?</DialogTitle>
          </div>
          <DialogDescription>
            <strong className="text-fg">{deleteTarget?.name}</strong> will be permanently removed from the list.
            Students who already registered at this centre are not affected — their records are stored by name.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteCentre.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              Delete centre
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
