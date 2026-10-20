import { Company } from './company.entity';

export interface CompanyRepository {
  getById(id: string): Promise<Company | null>;
  save(company: Company): Promise<void>;
}
