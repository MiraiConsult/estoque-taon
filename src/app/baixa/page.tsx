'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, formatDateTime, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  History,
  X,
  Trash2,
  ArrowRight,
  Search,
  Eraser,
  Plus,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';

type Step = 'upload' | 'review' | 'done';

interface PreviewRow {
  originalName: string;
  quantity: number;
  value: number;
  ticketMedio: number;
  matchedProductId: string | null;
  matchedProductName: string | null;
  status: 'matched' | 'fuzzy' | 'unmatched' | 'ignored';
}

interface Product {
  id: string;
  name: string;
  category: string;
  cost: number;
  linked_insumo_id: string | null;
  unit_conversion: number;
}

interface NewProductForm {
  rowIndex: number;
  name: string;
  category: string;
  salePrice: string;
  cost: string;
  quantity: string;
  minimum: string;
}

function normalizeName(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function ProductCombobox({
  products,
  value,
  disabled,
  onSelect,
  onCreateNew,
}: {
  products: Product[];
  value: string | null;
  disabled?: boolean;
  onSelect: (productId: string) => void;
  onCreateNew: (searchText: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = products.find((p) => p.id === value);

  const openPanel = () => {
    if (disabled || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const openUp = window.innerHeight - r.bottom < 320 && r.top > 320;
    setPos({
      left: Math.min(r.left, window.innerWidth - 300),
      width: Math.max(r.width, 280),
      ...(openUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
    setSearch('');
    setOpen(true);
  };

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = search
    ? products.filter((p) => normalizeName(p.name).includes(normalizeName(search)))
    : products;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-1 border border-gray-300 rounded px-2 py-1 text-xs text-left bg-white ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-gray-400'
        }`}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.name : '-- Selecione --'}
        </span>
        <ChevronDown size={12} className="shrink-0 text-gray-400" />
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
        >
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar produto..."
                className="w-full border border-gray-300 rounded pl-6 pr-2 py-1.5 text-xs"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onSelect('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 italic"
              >
                Remover vínculo
              </button>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${
                  p.id === value ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-800'
                }`}
              >
                <span className="truncate">{p.name}</span>
                {p.category && (
                  <span className="shrink-0 text-[10px] text-gray-400">{p.category}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-500 text-center">Nenhum produto encontrado</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreateNew(search.trim());
            }}
            className="w-full border-t border-gray-100 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-b-lg"
          >
            <Plus size={13} />
            Cadastrar novo produto{search.trim() ? ` "${search.trim()}"` : ''}
          </button>
        </div>
      )}
    </>
  );
}

interface ImportHistory {
  id: string;
  casa_name: string;
  event_date: string;
  event_name: string | null;
  file_name: string;
  total_items: number;
  total_value: number;
  created_at: string;
  pending_count: number;
}

type ProductMeta = { linked_insumo_id: string | null; unit_conversion: number };
type ComponentEntry = { component_product_id: string; quantity: number };

/**
 * Aplica a baixa/estorno de estoque de um produto vendido, tratando combos.
 * Se o produto for um combo (tem componentes), desce recursivamente nos componentes.
 * Senao, desconta do insumo vinculado (se houver) ou do proprio estoque do produto.
 * sign = -1 para baixa (venda), +1 para estorno (deletar importacao).
 */
async function applyStockDelta(
  casaId: string,
  productId: string,
  units: number,
  sign: number,
  productMap: Map<string, ProductMeta>,
  componentsByProduct: Map<string, ComponentEntry[]>,
  depth = 0
): Promise<void> {
  if (depth > 5) return; // protecao contra ciclos
  const components = componentsByProduct.get(productId);
  if (components && components.length > 0) {
    for (const c of components) {
      await applyStockDelta(
        casaId,
        c.component_product_id,
        units * c.quantity,
        sign,
        productMap,
        componentsByProduct,
        depth + 1
      );
    }
    return;
  }

  const meta = productMap.get(productId);
  const linkedInsumoId = meta?.linked_insumo_id || null;
  const conversion = meta?.unit_conversion || 1;

  if (linkedInsumoId) {
    const delta = sign * units * conversion;
    const { data: si } = await supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('casa_id', casaId)
      .eq('insumo_id', linkedInsumoId)
      .maybeSingle();
    if (si) {
      await supabase
        .from('stock_items')
        .update({ quantity: Math.max(0, Number(si.quantity) + delta), updated_at: new Date().toISOString() })
        .eq('id', si.id);
    }
  } else {
    const delta = sign * units;
    const { data: si } = await supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('casa_id', casaId)
      .eq('product_id', productId)
      .maybeSingle();
    if (si) {
      await supabase
        .from('stock_items')
        .update({ quantity: Math.max(0, Number(si.quantity) + delta), updated_at: new Date().toISOString() })
        .eq('id', si.id);
    }
  }
}

type RawRow = { originalName: string; quantity: number; value: number; ticketMedio: number };

/** Carrega os produtos de uma casa + o mapa de apelidos aprendidos. */
async function loadCasaCatalog(casaName: string): Promise<{ casaId: string | null; products: Product[]; aliasMap: Map<string, string> }> {
  const { data: casaRow } = await supabase.from('casas').select('id').eq('name', casaName).single();
  let productsQuery = supabase
    .from('products')
    .select('id, name, category, cost, linked_insumo_id, unit_conversion');
  if (casaRow) productsQuery = productsQuery.eq('casa_id', casaRow.id);
  const { data: productsData } = await productsQuery;
  const products: Product[] = (productsData || []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category || '',
    cost: Number(p.cost),
    linked_insumo_id: p.linked_insumo_id || null,
    unit_conversion: Number(p.unit_conversion) || 1,
  }));

  const { data: aliasesData } = await supabase.from('product_aliases').select('alias, product_id');
  const aliasMap = new Map<string, string>();
  (aliasesData || []).forEach((a: { alias: string; product_id: string }) => {
    aliasMap.set(a.alias.toUpperCase().trim(), a.product_id);
  });

  return { casaId: casaRow?.id ?? null, products, aliasMap };
}

/** Casa linhas cruas (arquivo ou pendências) contra o catálogo, via apelido, exato e fuzzy. */
function matchRawRows(raw: RawRow[], allProducts: Product[], aliasMap: Map<string, string>): PreviewRow[] {
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/['`']/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const exactMap = new Map<string, { id: string; name: string }>();
  const normMap = new Map<string, { id: string; name: string }>();
  allProducts.forEach((p) => {
    exactMap.set(p.name.toUpperCase().trim(), { id: p.id, name: p.name });
    normMap.set(normalize(p.name), { id: p.id, name: p.name });
  });

  const fuzzyMatch = (search: string): { id: string; name: string } | null => {
    const normSearch = normalize(search);
    if (!normSearch) return null;
    const direct = normMap.get(normSearch);
    if (direct) return direct;
    let best: { id: string; name: string; score: number } | null = null;
    for (const [normName, p] of normMap) {
      if (normName.length < 3) continue;
      let score = 0;
      if (normName === normSearch) score = 100;
      else if (normName.includes(normSearch) || normSearch.includes(normName)) {
        score = (Math.min(normName.length, normSearch.length) / Math.max(normName.length, normSearch.length)) * 80;
      } else {
        const w1 = new Set(normSearch.split(' ').filter((x) => x.length > 2));
        const w2 = new Set(normName.split(' ').filter((x) => x.length > 2));
        const common = [...w1].filter((w) => w2.has(w)).length;
        if (common > 0 && w1.size > 0 && w2.size > 0) score = (common / Math.max(w1.size, w2.size)) * 60;
      }
      if (score >= 50 && (!best || score > best.score)) best = { ...p, score };
    }
    return best;
  };

  return raw
    .map((rr) => {
      const productName = rr.originalName;
      const aliasProductId = aliasMap.get(productName.toUpperCase().trim());
      let matched: { id: string; name: string } | null = null;
      let status: PreviewRow['status'] = 'unmatched';

      if (aliasProductId) {
        const aliasProduct = allProducts.find((p) => p.id === aliasProductId);
        if (aliasProduct) {
          matched = { id: aliasProduct.id, name: aliasProduct.name };
          status = 'matched';
        }
      }
      if (!matched) {
        const exact = exactMap.get(productName.toUpperCase().trim());
        if (exact) {
          matched = exact;
          status = 'matched';
        }
      }
      if (!matched) {
        const fuzzy = fuzzyMatch(productName);
        if (fuzzy) {
          matched = fuzzy;
          status = 'fuzzy';
        }
      }

      return {
        originalName: productName,
        quantity: rr.quantity,
        value: rr.value,
        ticketMedio: rr.ticketMedio || (rr.quantity > 0 ? rr.value / rr.quantity : 0),
        matchedProductId: matched?.id || null,
        matchedProductName: matched?.name || null,
        status,
      };
    })
    .filter((r) => r.originalName && r.quantity > 0);
}

export default function BaixaPage() {
  const [step, setStep] = useState<Step>('upload');
  const [selectedCasa, setSelectedCasa] = useState('Isla');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventName, setEventName] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ matched: number; ignored: number; totalValue: number; totalItems: number; learnedAliases: number } | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [searchUnmatched, setSearchUnmatched] = useState('');
  const [newProduct, setNewProduct] = useState<NewProductForm | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [resumeImportId, setResumeImportId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sale_imports')
        .select('*, casa:casas(name), pending:sale_import_pending(count)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setHistory(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any[]).map((d) => ({
            id: d.id,
            casa_name: d.casa?.name || '',
            event_date: d.event_date,
            event_name: d.event_name,
            file_name: d.file_name,
            total_items: d.total_items,
            total_value: d.total_value,
            created_at: d.created_at,
            pending_count: d.pending?.[0]?.count ?? 0,
          }))
        );
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;

      // Produtos da casa + apelidos aprendidos
      const { products: allProducts, aliasMap } = await loadCasaCatalog(selectedCasa);
      setProducts(allProducts);

      const raw: RawRow[] = jsonData.map((row) => {
        const originalName = String(
          row['produto'] || row['Produto'] || row['PRODUTO'] || row['product'] || ''
        ).trim();
        const quantity = Number(row['quantidade'] || row['Quantidade'] || row['QUANTIDADE'] || row['qty'] || 0);
        const value = Number(row['valor'] || row['Valor'] || row['VALOR'] || row['value'] || 0);
        const ticketMedio = Number(row['ticket_medio'] || row['Ticket Medio'] || row['TICKET_MEDIO'] || 0);
        return { originalName, quantity, value, ticketMedio };
      });

      setResumeImportId(null);
      setRows(matchRawRows(raw, allProducts, aliasMap));
      setStep('review');
    };
    reader.readAsBinaryString(file);
  };

  // Reabre uma importação anterior carregando as linhas que ficaram pendentes,
  // re-tentando casar com os produtos que existem hoje.
  const reopenImport = async (imp: ImportHistory) => {
    try {
      const { data: pend } = await supabase
        .from('sale_import_pending')
        .select('original_name, quantity, value, ticket_medio')
        .eq('import_id', imp.id)
        .order('original_name');

      if (!pend || pend.length === 0) {
        alert('Esta importação não tem linhas pendentes para vincular.');
        return;
      }

      const { products: allProducts, aliasMap } = await loadCasaCatalog(imp.casa_name);
      setProducts(allProducts);

      const raw: RawRow[] = pend.map((p) => ({
        originalName: p.original_name,
        quantity: Number(p.quantity),
        value: Number(p.value),
        ticketMedio: Number(p.ticket_medio),
      }));

      setSelectedCasa(imp.casa_name);
      setEventDate(imp.event_date);
      setEventName(imp.event_name || '');
      setFileName(imp.file_name);
      setResumeImportId(imp.id);
      setImportResult(null);
      setSearchUnmatched('');
      setRows(matchRawRows(raw, allProducts, aliasMap));
      setStep('review');
    } catch (err) {
      alert(`Erro ao reabrir: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const resetUpload = () => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setProducts([]);
    setImportResult(null);
    setSearchUnmatched('');
    setResumeImportId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateRowMatch = (index: number, productId: string) => {
    const matchedProduct = products.find((p) => p.id === productId);
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              matchedProductId: productId || null,
              matchedProductName: matchedProduct?.name || null,
              status: productId ? 'matched' : 'unmatched',
            }
          : r
      )
    );
  };

  const titleCase = (s: string) =>
    s
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const openNewProduct = (rowIndex: number, searchText: string) => {
    const row = rows[rowIndex];
    setNewProduct({
      rowIndex,
      name: titleCase(searchText || row.originalName),
      category: '',
      salePrice: row.ticketMedio > 0 ? row.ticketMedio.toFixed(2) : '',
      cost: '',
      quantity: '0',
      minimum: '0',
    });
  };

  const saveNewProduct = async () => {
    if (!newProduct) return;
    const name = newProduct.name.trim();
    if (!name) {
      alert('Informe o nome do produto');
      return;
    }

    const duplicate = products.find((p) => normalizeName(p.name) === normalizeName(name));
    if (duplicate) {
      alert(`Já existe um produto com esse nome: "${duplicate.name}". Selecione-o na lista.`);
      return;
    }

    setSavingProduct(true);
    try {
      const { data: casa } = await supabase.from('casas').select('id').eq('name', selectedCasa).single();
      if (!casa) throw new Error('Casa não encontrada');

      const salePrice = Number(newProduct.salePrice) || 0;
      const cost = Number(newProduct.cost) || 0;
      const quantity = Number(newProduct.quantity) || 0;
      const minimum = Number(newProduct.minimum) || 0;

      const { data: created, error: prodErr } = await supabase
        .from('products')
        .insert({
          name,
          category: newProduct.category.trim() || 'Outros',
          type: 'product',
          sale_price: salePrice,
          cost,
          margin: salePrice > 0 ? salePrice - cost : 0,
          markup: salePrice > 0 && cost > 0 ? salePrice / cost : 0,
          casa_id: casa.id,
        })
        .select('id, name, category, cost')
        .single();

      if (prodErr || !created) throw new Error(prodErr?.message || 'Falha ao criar produto');

      const { error: stockErr } = await supabase.from('stock_items').insert({
        casa_id: casa.id,
        product_id: created.id,
        insumo_id: null,
        quantity,
        minimum,
        unit: 'un',
      });
      if (stockErr) throw new Error(`Produto criado, mas falhou o estoque: ${stockErr.message}`);

      await supabase.from('stock_movements').insert({
        casa_id: casa.id,
        product_id: created.id,
        insumo_id: null,
        movement_type: 'ajuste',
        quantity,
        notes: 'Cadastro via importação de vendas',
      });

      const newEntry: Product = {
        id: created.id,
        name: created.name,
        category: created.category || '',
        cost: Number(created.cost) || 0,
        linked_insumo_id: null,
        unit_conversion: 1,
      };
      setProducts((prev) => [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name)));

      const rowIndex = newProduct.rowIndex;
      setRows((prev) =>
        prev.map((r, i) =>
          i === rowIndex
            ? { ...r, matchedProductId: newEntry.id, matchedProductName: newEntry.name, status: 'matched' }
            : r
        )
      );
      setNewProduct(null);
    } catch (err) {
      alert(`Erro ao cadastrar produto: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const confirmFuzzy = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, status: 'matched' } : r))
    );
  };

  const toggleIgnore = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, status: r.status === 'ignored' ? (r.matchedProductId ? 'matched' : 'unmatched') : 'ignored' }
          : r
      )
    );
  };

  const confirmImport = async () => {
    setImporting(true);

    try {
      const { data: casa } = await supabase.from('casas').select('id').eq('name', selectedCasa).single();
      if (!casa) throw new Error('Casa nao encontrada');

      const toImport = rows.filter((r) => r.status === 'matched' && r.matchedProductId);

      // Save aliases for non-exact matches so future imports auto-identify
      const aliasesToSave = toImport
        .filter((r) => {
          const exact = r.matchedProductName?.toUpperCase().trim() === r.originalName.toUpperCase().trim();
          return !exact && r.matchedProductId && r.originalName;
        })
        .map((r) => ({
          alias: r.originalName.trim(),
          product_id: r.matchedProductId!,
        }));

      if (aliasesToSave.length > 0) {
        // Use upsert with onConflict on alias unique constraint
        await supabase.from('product_aliases').upsert(aliasesToSave, { onConflict: 'alias' });
      }

      const totalValue = toImport.reduce((s, r) => s + r.value, 0);
      const totalItems = toImport.reduce((s, r) => s + r.quantity, 0);

      // Nova importação: cria o registro. Retomada: reutiliza o existente.
      let importId: string;
      if (resumeImportId) {
        importId = resumeImportId;
      } else {
        const { data: importRecord, error: impErr } = await supabase
          .from('sale_imports')
          .insert({
            casa_id: casa.id,
            event_date: eventDate,
            event_name: eventName || null,
            file_name: fileName,
            total_items: totalItems,
            total_value: totalValue,
          })
          .select('id')
          .single();

        if (impErr || !importRecord) throw new Error(impErr?.message || 'Falha ao criar importacao');
        importId = importRecord.id;
      }

      // Insert sales with import_id
      const salesRecords = toImport.map((r) => ({
        casa_id: casa.id,
        import_id: importId,
        event_date: eventDate,
        event_name: eventName || null,
        product_id: r.matchedProductId!,
        quantity: r.quantity,
        total_value: r.value,
        ticket_medio: r.ticketMedio,
      }));

      if (salesRecords.length > 0) await supabase.from('sales').insert(salesRecords);

      // Build product metadata + combo component maps for cascading deduction
      const { data: componentsData } = await supabase
        .from('product_components')
        .select('product_id, component_product_id, quantity');
      const componentsByProduct = new Map<string, ComponentEntry[]>();
      (componentsData || []).forEach((c: { product_id: string; component_product_id: string; quantity: number }) => {
        const arr = componentsByProduct.get(c.product_id) || [];
        arr.push({ component_product_id: c.component_product_id, quantity: Number(c.quantity) });
        componentsByProduct.set(c.product_id, arr);
      });
      const productMap = new Map<string, ProductMeta>(
        products.map((p) => [p.id, { linked_insumo_id: p.linked_insumo_id, unit_conversion: p.unit_conversion }])
      );

      // Update stock + create movements
      for (const r of toImport) {
        // Baixa em cascata (trata combos -> componentes -> insumo/produto)
        await applyStockDelta(casa.id, r.matchedProductId!, r.quantity, -1, productMap, componentsByProduct);

        // Recipe ingredients deduction
        const { data: recipe } = await supabase
          .from('drink_recipes')
          .select('id')
          .eq('product_id', r.matchedProductId!)
          .maybeSingle();

        if (recipe) {
          const { data: ingredients } = await supabase
            .from('recipe_ingredients')
            .select('insumo_id, quantity')
            .eq('recipe_id', recipe.id);

          if (ingredients) {
            for (const ing of ingredients) {
              const totalUsed = ing.quantity * r.quantity;
              const { data: insumoStock } = await supabase
                .from('stock_items')
                .select('id, quantity')
                .eq('casa_id', casa.id)
                .eq('insumo_id', ing.insumo_id)
                .maybeSingle();

              if (insumoStock) {
                await supabase
                  .from('stock_items')
                  .update({
                    quantity: Math.max(0, insumoStock.quantity - totalUsed),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', insumoStock.id);
              }
            }
          }
        }

        await supabase.from('stock_movements').insert({
          casa_id: casa.id,
          product_id: r.matchedProductId!,
          import_id: importId,
          movement_type: 'venda',
          quantity: -r.quantity,
          reference: `Venda ${eventDate}`,
          notes: eventName || null,
        });
      }

      // Retomada: soma os novos totais ao registro existente.
      if (resumeImportId && toImport.length > 0) {
        const { data: cur } = await supabase
          .from('sale_imports')
          .select('total_items, total_value')
          .eq('id', importId)
          .single();
        await supabase
          .from('sale_imports')
          .update({
            total_items: (Number(cur?.total_items) || 0) + totalItems,
            total_value: (Number(cur?.total_value) || 0) + totalValue,
          })
          .eq('id', importId);
      }

      // Sincroniza as pendências: o que ficou sem vínculo continua salvo para retomar depois.
      const pendingRows = rows.filter((r) => r.status === 'unmatched' || r.status === 'ignored');
      await supabase.from('sale_import_pending').delete().eq('import_id', importId);
      if (pendingRows.length > 0) {
        await supabase.from('sale_import_pending').insert(
          pendingRows.map((r) => ({
            import_id: importId,
            casa_id: casa.id,
            original_name: r.originalName,
            quantity: r.quantity,
            value: r.value,
            ticket_medio: r.ticketMedio,
          }))
        );
      }

      setImportResult({ matched: toImport.length, ignored: pendingRows.length, totalValue, totalItems, learnedAliases: aliasesToSave.length });
      setStep('done');
      fetchHistory();
    } catch (err) {
      alert(`Erro ao importar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const deleteImport = async (importId: string) => {
    try {
      // Get all sales from this import to reverse stock
      const { data: sales } = await supabase
        .from('sales')
        .select('product_id, quantity, casa_id')
        .eq('import_id', importId);

      if (sales && sales.length > 0) {
        // Build fresh product metadata + component maps
        const { data: allProducts } = await supabase
          .from('products')
          .select('id, linked_insumo_id, unit_conversion');
        const productMap = new Map<string, ProductMeta>(
          (allProducts || []).map((p: { id: string; linked_insumo_id: string | null; unit_conversion: number }) => [
            p.id,
            { linked_insumo_id: p.linked_insumo_id || null, unit_conversion: Number(p.unit_conversion) || 1 },
          ])
        );
        const { data: componentsData } = await supabase
          .from('product_components')
          .select('product_id, component_product_id, quantity');
        const componentsByProduct = new Map<string, ComponentEntry[]>();
        (componentsData || []).forEach((c: { product_id: string; component_product_id: string; quantity: number }) => {
          const arr = componentsByProduct.get(c.product_id) || [];
          arr.push({ component_product_id: c.component_product_id, quantity: Number(c.quantity) });
          componentsByProduct.set(c.product_id, arr);
        });

        for (const sale of sales) {
          // Estorno em cascata (trata combos)
          await applyStockDelta(sale.casa_id, sale.product_id, sale.quantity, +1, productMap, componentsByProduct);

          // Reverse recipe ingredients
          const { data: recipe } = await supabase
            .from('drink_recipes')
            .select('id')
            .eq('product_id', sale.product_id)
            .maybeSingle();

          if (recipe) {
            const { data: ingredients } = await supabase
              .from('recipe_ingredients')
              .select('insumo_id, quantity')
              .eq('recipe_id', recipe.id);

            if (ingredients) {
              for (const ing of ingredients) {
                const { data: insumoStock } = await supabase
                  .from('stock_items')
                  .select('id, quantity')
                  .eq('casa_id', sale.casa_id)
                  .eq('insumo_id', ing.insumo_id)
                  .maybeSingle();

                if (insumoStock) {
                  await supabase
                    .from('stock_items')
                    .update({
                      quantity: insumoStock.quantity + (ing.quantity * sale.quantity),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', insumoStock.id);
                }
              }
            }
          }
        }
      }

      // Delete the import (cascades to sales and stock_movements)
      await supabase.from('sale_imports').delete().eq('id', importId);
      setDeleteConfirm(null);
      fetchHistory();
    } catch (err) {
      alert(`Erro ao deletar: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const clearAllImports = async () => {
    try {
      // Get all imports to reverse
      const { data: allImports } = await supabase.from('sale_imports').select('id');
      if (allImports) {
        for (const imp of allImports) {
          await deleteImport(imp.id);
        }
      }
      setClearAllConfirm(false);
      fetchHistory();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const matchedCount = rows.filter((r) => r.status === 'matched').length;
  const fuzzyCount = rows.filter((r) => r.status === 'fuzzy').length;
  const unmatchedCount = rows.filter((r) => r.status === 'unmatched').length;
  const ignoredCount = rows.filter((r) => r.status === 'ignored').length;
  const filteredAttention = rows
    .map((r, i) => ({ ...r, _idx: i }))
    .filter((r) => r.status !== 'matched')
    .filter((r) => !searchUnmatched || r.originalName.toLowerCase().includes(searchUnmatched.toLowerCase()));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Importar Vendas</h1>
        <p className="text-sm text-gray-500">
          Importe planilhas de vendas para dar baixa no estoque automaticamente
        </p>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Nova Importacao</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Casa</label>
              <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} showAll={false} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data do Evento</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Evento (opcional)</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Ex: Festa de Sexta"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileSpreadsheet size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-900">Clique para selecionar a planilha</p>
            <p className="text-xs text-gray-500 mt-1">Formatos: .xlsx, .xls, .csv</p>
            <p className="text-xs text-gray-400 mt-1">Colunas: produto, quantidade, valor, ticket_medio</p>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW */}
      {step === 'review' && (
        <div className="space-y-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  {resumeImportId ? 'Retomando Importação' : 'Revisao da Importacao'}
                  {resumeImportId && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      concluir pendências
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Arquivo: {fileName} - {selectedCasa} - {eventDate}</p>
              </div>
              <button onClick={resetUpload} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <X size={14} /> Cancelar
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{matchedCount}</p>
                <p className="text-xs text-emerald-600">Identificados</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{fuzzyCount}</p>
                <p className="text-xs text-yellow-600">Similares (Confirmar)</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{unmatchedCount}</p>
                <p className="text-xs text-amber-600">Nao Identificados</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-700">{ignoredCount}</p>
                <p className="text-xs text-gray-600">Ignorados</p>
              </div>
            </div>
          </div>

          {/* Unmatched + fuzzy products to fix */}
          {(unmatchedCount > 0 || ignoredCount > 0 || fuzzyCount > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-amber-700 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Produtos que precisam de atencao
                </h4>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchUnmatched}
                    onChange={(e) => setSearchUnmatched(e.target.value)}
                    placeholder="Buscar..."
                    className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                <span className="text-yellow-700 font-medium">Similares</span>: o sistema encontrou um produto parecido - confirme se esta correto.{' '}
                <span className="text-amber-700 font-medium">Nao Identificados</span>: selecione um produto manualmente ou ignore.
              </p>
              <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Nome na Planilha</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Qtd</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Valor</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Vincular a Produto</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttention.map((r) => (
                      <tr
                        key={r._idx}
                        className={`border-t ${
                          r.status === 'ignored' ? 'opacity-50 bg-gray-50' :
                          r.status === 'fuzzy' ? 'bg-yellow-50/50' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {r.originalName}
                          {r.status === 'fuzzy' && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800">
                              <AlertCircle size={10} /> Similar
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.value)}</td>
                        <td className="px-3 py-2">
                          <ProductCombobox
                            products={products}
                            value={r.matchedProductId}
                            disabled={r.status === 'ignored'}
                            onSelect={(productId) => updateRowMatch(r._idx, productId)}
                            onCreateNew={(searchText) => openNewProduct(r._idx, searchText)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            {r.status === 'fuzzy' && (
                              <button
                                onClick={() => confirmFuzzy(r._idx)}
                                className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                title="Confirmar este vinculo"
                              >
                                OK
                              </button>
                            )}
                            <button
                              onClick={() => toggleIgnore(r._idx)}
                              className={`text-xs px-2 py-1 rounded ${
                                r.status === 'ignored'
                                  ? 'bg-gray-200 text-gray-700'
                                  : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            >
                              {r.status === 'ignored' ? 'Restaurar' : 'Ignorar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matched products preview */}
          {matchedCount > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-emerald-700 flex items-center gap-2 mb-3">
                <CheckCircle size={18} />
                Produtos identificados ({matchedCount})
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Vinculou errado? Troque o produto, remova o vínculo (volta para &quot;precisam de atenção&quot;) ou cadastre outro direto na coluna abaixo.
              </p>
              <div className="overflow-x-auto max-h-72 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Nome na Planilha</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Produto Vinculado</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Qtd</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .map((r, i) => ({ ...r, _idx: i }))
                      .filter((r) => r.status === 'matched')
                      .map((r) => (
                        <tr key={r._idx} className="border-t">
                          <td className="px-3 py-2 text-gray-700">{r.originalName}</td>
                          <td className="px-3 py-2 min-w-[200px]">
                            <ProductCombobox
                              products={products}
                              value={r.matchedProductId}
                              onSelect={(productId) => updateRowMatch(r._idx, productId)}
                              onCreateNew={(searchText) => openNewProduct(r._idx, searchText)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm button */}
          <div className="flex gap-3">
            <button
              onClick={resetUpload}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Voltar
            </button>
            <button
              onClick={confirmImport}
              disabled={importing || matchedCount === 0}
              className="flex-1 bg-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  {resumeImportId
                    ? `Concluir pendências (${matchedCount} vinculados)`
                    : `Confirmar e Importar (${matchedCount} produtos)`}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DONE */}
      {step === 'done' && importResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Importacao realizada com sucesso!</h3>
            <p className="text-sm text-gray-600 mb-6">
              {importResult.matched} produtos importados | {importResult.totalItems} unidades | {formatCurrency(importResult.totalValue)}
              {importResult.ignored > 0 && <span className="block text-amber-600 text-xs mt-1">{importResult.ignored} linhas ignoradas</span>}
              {importResult.learnedAliases > 0 && (
                <span className="block text-blue-600 text-xs mt-1">
                  {importResult.learnedAliases} {importResult.learnedAliases === 1 ? 'novo apelido aprendido' : 'novos apelidos aprendidos'} - proximas importacoes vao reconhecer automaticamente
                </span>
              )}
            </p>
            <button
              onClick={resetUpload}
              className="bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-800 flex items-center gap-2 mx-auto"
            >
              <ArrowRight size={16} />
              Nova Importacao
            </button>
          </div>
        </div>
      )}

      {/* HISTORY */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <History size={18} />
            Historico de Importacoes
          </h3>
          {history.length > 0 && (
            <button
              onClick={() => setClearAllConfirm(true)}
              className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
            >
              <Eraser size={14} />
              Limpar Tudo
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Data</th>
                <th className="pb-2 font-medium">Casa</th>
                <th className="pb-2 font-medium">Evento</th>
                <th className="pb-2 font-medium">Arquivo</th>
                <th className="pb-2 font-medium text-right">Itens</th>
                <th className="pb-2 font-medium text-right">Valor</th>
                <th className="pb-2 font-medium">Pendentes</th>
                <th className="pb-2 font-medium">Importado em</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{h.event_date}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(h.casa_name)}`}>
                      {h.casa_name}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{h.event_name || '-'}</td>
                  <td className="py-2 text-gray-600 max-w-[150px] truncate" title={h.file_name}>{h.file_name}</td>
                  <td className="py-2 text-right text-gray-900">{formatNumber(h.total_items)}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(h.total_value)}</td>
                  <td className="py-2">
                    {h.pending_count > 0 ? (
                      <button
                        onClick={() => reopenImport(h)}
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                        title="Reabrir para vincular os produtos que ficaram pendentes"
                      >
                        <RotateCcw size={12} />
                        Retomar ({h.pending_count})
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 text-gray-500 text-xs">{formatDateTime(h.created_at)}</td>
                  <td className="py-2 text-right">
                    {deleteConfirm === h.id ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => deleteImport(h.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(h.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Excluir importacao"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    Nenhuma importacao realizada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New product modal */}
      {newProduct && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg text-gray-900">Cadastrar novo produto</h3>
              <button onClick={() => setNewProduct(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Casa: <span className="font-medium">{selectedCasa}</span> · o produto e o estoque inicial serão criados e já vinculados a esta linha.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                <input
                  type="text"
                  list="baixa-categorias"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  placeholder="Ex: Soft Drinks, Cerveja, Vinho..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <datalist id="baixa-categorias">
                  {[...new Set(products.map((p) => p.category).filter(Boolean))].sort().map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Preço de venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.salePrice}
                    onChange={(e) => setNewProduct({ ...newProduct, salePrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.cost}
                    onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estoque atual</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estoque mínimo</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={newProduct.minimum}
                    onChange={(e) => setNewProduct({ ...newProduct, minimum: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setNewProduct(null)}
                disabled={savingProduct}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveNewProduct}
                disabled={savingProduct}
                className="flex-1 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingProduct ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Cadastrar e vincular
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear all confirmation modal */}
      {clearAllConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md">
            <h3 className="font-bold text-lg text-gray-900 mb-2">Limpar todo o historico?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Isso vai deletar TODAS as importacoes, reverter o estoque de cada venda e restaurar os insumos consumidos. Essa acao nao pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setClearAllConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={clearAllImports}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-red-700"
              >
                Sim, limpar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
