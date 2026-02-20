
import { Client, Product, User } from './types';

export const COMPANY_INFO = {
  name: "Madeiras Ouro Preto",
  cnpj: "12.345.678/0001-90", // Mock
  address: "R. Dona Francisca, 4490 - Santo Antônio, Joinville",
  email: "contato@madeirasouropreto.com.br",
  whatsapp: "5547984350712",
  phoneDisplay: "+55 47 9 8435-0712"
};

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Administrador', email: 'admin@mop.com.br', password: '123', role: 'admin' },
  { id: '2', name: 'Vendedor João', email: 'joao@mop.com.br', password: '123', role: 'sales' },
  { id: '3', name: 'Vendedor Maria', email: 'maria@mop.com.br', password: '123', role: 'sales' },
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'João da Silva Construções',
    document: '123.456.789-00',
    phone: '(47) 99999-9999',
    email: 'joao@construcoes.com',
    address: 'Rua das Palmeiras, 100, Joinville - SC',
    type: 'PF',
    internalNotes: 'Cliente antigo, sempre paga à vista.'
  },
  {
    id: 'c2',
    name: 'Construtora XYZ Ltda',
    document: '12.345.678/0001-00',
    phone: '(47) 3333-3333',
    email: 'compras@xyz.com.br',
    address: 'Av. Santos Dumont, 500, Joinville - SC',
    type: 'PJ',
    internalNotes: 'Exige nota fiscal em todos os pedidos.'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    code: 'MAD001',
    name: 'Tábua Pinus 30cm',
    category: 'Madeira Bruta',
    price: 25.00,
    cost: 15.00,
    // Fix: 'Metro' is not a valid ProductUnit, using 'm' instead
    unit: 'm'
  },
  {
    id: 'p2',
    code: 'MAD002',
    name: 'Viga Garapeira 15x15',
    category: 'Madeira Nobre',
    price: 150.00,
    cost: 100.00,
    // Fix: 'Metro' is not a valid ProductUnit, using 'm' instead
    unit: 'm'
  },
  {
    id: 'p3',
    code: 'SERV01',
    name: 'Aplicação de Verniz',
    category: 'Serviços',
    price: 80.00,
    cost: 20.00,
    // Fix: 'Hora' is not a valid ProductUnit, using 'un' instead
    unit: 'un'
  },
  {
    id: 'p4',
    code: 'COMP01',
    name: 'Compensado Naval 10mm',
    category: 'Chapas',
    price: 120.00,
    cost: 85.00,
    // Fix: 'Unidade' is not a valid ProductUnit, using 'un' instead
    unit: 'un'
  }
];
