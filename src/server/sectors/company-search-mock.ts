import type {
  CompanyScreenerResponse,
  CompanyScreenerResult,
} from "../../shared/schemas/company-search.ts";

export type CompanySearchOptions = {
  readonly query: string;
  readonly limit: number;
  readonly offset: number;
};

const MOCK_COMPANIES: readonly CompanyScreenerResult[] = [
  { symbol: "AADI.JK", company_name: "PT Adaro Andalan Indonesia Tbk." },
  { symbol: "ADRO.JK", company_name: "PT Alamtri Resources Indonesia Tbk." },
  { symbol: "AKRA.JK", company_name: "PT AKR Corporindo Tbk." },
  { symbol: "AMMN.JK", company_name: "PT Amman Mineral Internasional Tbk." },
  { symbol: "AMRT.JK", company_name: "PT Sumber Alfaria Trijaya Tbk." },
  { symbol: "ANTM.JK", company_name: "Aneka Tambang Tbk." },
  { symbol: "ARTO.JK", company_name: "PT Bank Jago Tbk." },
  { symbol: "ASII.JK", company_name: "PT Astra International Tbk." },
  { symbol: "BBCA.JK", company_name: "PT Bank Central Asia Tbk." },
  { symbol: "BBNI.JK", company_name: "PT Bank Negara Indonesia (Persero) Tbk." },
  { symbol: "BBRI.JK", company_name: "PT Bank Rakyat Indonesia (Persero) Tbk." },
  { symbol: "BBTN.JK", company_name: "PT Bank Tabungan Negara (Persero) Tbk." },
  { symbol: "BBYB.JK", company_name: "PT Bank Neo Commerce Tbk." },
  { symbol: "BMRI.JK", company_name: "PT Bank Mandiri (Persero) Tbk." },
  { symbol: "BRIS.JK", company_name: "PT Bank Syariah Indonesia Tbk." },
  { symbol: "BRPT.JK", company_name: "PT Barito Pacific Tbk." },
  { symbol: "BSDE.JK", company_name: "PT Bumi Serpong Damai Tbk." },
  { symbol: "BUKA.JK", company_name: "PT Bukalapak.com Tbk." },
  { symbol: "BYAN.JK", company_name: "PT Bayan Resources Tbk." },
  { symbol: "CPIN.JK", company_name: "PT Charoen Pokphand Indonesia Tbk." },
  { symbol: "CTRA.JK", company_name: "PT Ciputra Development Tbk." },
  { symbol: "GOTO.JK", company_name: "PT GoTo Gojek Tokopedia Tbk." },
  { symbol: "HEAL.JK", company_name: "PT Medikaloka Hermina Tbk." },
  { symbol: "ICBP.JK", company_name: "PT Indofood CBP Sukses Makmur Tbk." },
  { symbol: "INCO.JK", company_name: "PT Vale Indonesia Tbk." },
  { symbol: "INDF.JK", company_name: "PT Indofood Sukses Makmur Tbk." },
  { symbol: "INTP.JK", company_name: "PT Indocement Tunggal Prakarsa Tbk." },
  { symbol: "ISAT.JK", company_name: "PT Indosat Tbk." },
  { symbol: "ITMG.JK", company_name: "PT Indo Tambangraya Megah Tbk." },
  { symbol: "JSMR.JK", company_name: "PT Jasa Marga (Persero) Tbk." },
  { symbol: "JPFA.JK", company_name: "PT Japfa Comfeed Indonesia Tbk." },
  { symbol: "KLBF.JK", company_name: "PT Kalbe Farma Tbk." },
  { symbol: "MBMA.JK", company_name: "PT Merdeka Battery Materials Tbk." },
  { symbol: "MEDC.JK", company_name: "PT Medco Energi Internasional Tbk." },
  { symbol: "MDKA.JK", company_name: "PT Merdeka Copper Gold Tbk." },
  { symbol: "MIKA.JK", company_name: "PT Mitra Keluarga Karyasehat Tbk." },
  { symbol: "MIDI.JK", company_name: "PT Midi Utama Indonesia Tbk." },
  { symbol: "MYOR.JK", company_name: "PT Mayora Indah Tbk." },
  { symbol: "NISP.JK", company_name: "PT Bank OCBC NISP Tbk." },
  { symbol: "PANI.JK", company_name: "PT Pantai Indah Kapuk Dua Tbk." },
  { symbol: "PGAS.JK", company_name: "PT Perusahaan Gas Negara Tbk." },
  { symbol: "PGEO.JK", company_name: "PT Pertamina Geothermal Energy Tbk." },
  { symbol: "PTBA.JK", company_name: "PT Bukit Asam Tbk." },
  { symbol: "PTRO.JK", company_name: "PT Petrosea Tbk." },
  { symbol: "PWON.JK", company_name: "PT Pakuwon Jati Tbk." },
  { symbol: "SIDO.JK", company_name: "PT Industri Jamu dan Farmasi Sido Muncul Tbk." },
  { symbol: "SILO.JK", company_name: "PT Siloam International Hospitals Tbk." },
  { symbol: "SMGR.JK", company_name: "PT Semen Indonesia (Persero) Tbk." },
  { symbol: "TINS.JK", company_name: "PT Timah Tbk." },
  { symbol: "TLKM.JK", company_name: "PT Telkom Indonesia (Persero) Tbk." },
  { symbol: "UNTR.JK", company_name: "PT United Tractors Tbk." },
  { symbol: "UNVR.JK", company_name: "PT Unilever Indonesia Tbk." },
];

export async function searchCompaniesMock({
  query,
  limit,
  offset,
}: CompanySearchOptions): Promise<CompanyScreenerResponse> {
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const matchingCompanies = MOCK_COMPANIES.filter((company) => {
    if (!normalizedQuery) return true;
    return `${company.symbol} ${company.company_name}`
      .toLocaleLowerCase("id-ID")
      .includes(normalizedQuery);
  });
  const results = matchingCompanies.slice(offset, offset + limit);
  const hasNext = offset + limit < matchingCompanies.length;
  const hasPrevious = offset > 0 && matchingCompanies.length > 0;
  const where = normalizedQuery
    ? `symbol like '%${query}%' or company_name like '%${query}%'`
    : null;

  return {
    results,
    pagination: {
      total_count: matchingCompanies.length,
      showing: results.length,
      limit,
      offset,
      has_next: hasNext,
      has_previous: hasPrevious,
      next_offset: hasNext ? offset + limit : null,
      previous_offset: hasPrevious ? Math.max(0, offset - limit) : null,
    },
    llm_translation: {
      natural_query: null,
      translated_params: {
        where,
        order_by: "symbol",
        limit,
        offset,
        include_query_values: false,
      },
      message: null,
    },
  };
}
