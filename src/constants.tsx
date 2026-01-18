
import React from 'react';
import { School, Staff, Student, AllotmentRecord, User, UserRole } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Admin Principal',
  email: 'admin@educalota.gov',
  role: UserRole.ADMIN,
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCKvnHuo0ruzNp38A3P55pBXP2Hcw3ForPeeCdCGo22KuO40hwQh2BwwGJizKvfzPp5jxN-qE-eYV2SwjSEz_mUBT6zjd3psjYMdjZehxJjipGO8SlU-Rc4rhe0wt4pcolaXik48VmdwR1pVQ4Dyvo6fkSLVC0gcLU3i9dhnOXQ13Y5Ie0e4jJTiHMssRZZ-k21Z4ajfMCTPZS4Z17XaLI6LSHUHOy-OuDaCXUhGPhn5Qm0ECkFeUS8bzJvch78ZgErUTO-OfhvUOul'
};

export const MOCK_SCHOOLS: School[] = [
  {
    id: 's1',
    name: 'E.M. Monteiro Lobato',
    location: 'Rua Norte, 123',
    region: 'Zona Norte',
    description: 'Escola com foco em inclusão e acessibilidade para cadeirantes.',
    studentsCount: 450,
    classesCount: 12,
    active: true,
    imageUrl: 'https://picsum.photos/seed/school1/800/600'
  },
  {
    id: 's2',
    name: 'C.E. Darcy Ribeiro',
    location: 'Av. Central, 500',
    region: 'Centro',
    description: 'Centro especializado com salas de recursos multifuncionais.',
    studentsCount: 320,
    classesCount: 8,
    active: true,
    imageUrl: 'https://picsum.photos/seed/school2/800/600'
  },
  {
    id: 's3',
    name: 'E.M. Cora Coralina',
    location: 'Rua Sul, 45',
    region: 'Zona Sul',
    description: 'Unidade com rampas de acesso e banheiros adaptados.',
    studentsCount: 510,
    classesCount: 15,
    active: true,
    imageUrl: 'https://picsum.photos/seed/school3/800/600'
  }
];

export const MOCK_STAFF: Staff[] = [
  {
    id: 'st1',
    name: 'Ana Maria Silva',
    registration: '123456',
    role: 'Professor AEE',
    contractType: 'Efetivo',
    hoursTotal: 200,
    hoursAvailable: 120,
    avatar: 'https://i.pravatar.cc/150?u=ana'
  },
  {
    id: 'st2',
    name: 'Carlos Oliveira',
    registration: '987654',
    role: 'Apoio',
    contractType: 'Contrato',
    hoursTotal: 150,
    hoursAvailable: 150,
    avatar: 'https://i.pravatar.cc/150?u=carlos'
  },
  {
    id: 'st3',
    name: 'Mariana Souza',
    registration: '456789',
    role: 'Psicólogo',
    contractType: 'Efetivo',
    hoursTotal: 100,
    hoursAvailable: 40,
    avatar: 'https://i.pravatar.cc/150?u=mariana'
  }
];

export const MOCK_STUDENTS: Student[] = [
  {
    id: 'std1',
    name: 'João Pedro Santos',
    birthDate: '2014-05-10',
    series: '5º Ano A',
    cid: 'F84.0',
    specialGroup: 'TEA',
    needsSupport: ['Mediador', 'Cuidador']
  },
  {
    id: 'std2',
    name: 'Maria Luiza Lima',
    birthDate: '2012-08-20',
    series: '7º Ano B',
    cid: 'G80',
    specialGroup: 'Def. Física',
    needsSupport: ['Cuidador']
  }
];

export const MOCK_ALLOTMENTS: AllotmentRecord[] = [
  { id: 'al1', staffName: 'Ana Paula Silva', staffRole: 'Monitor de Apoio', schoolName: 'E.M. João Cabral', date: '24/10/2023', status: 'Concluído' },
  { id: 'al2', staffName: 'Carlos Eduardo', staffRole: 'Intérprete LIBRAS', schoolName: 'C.E. Cora Coralina', date: '23/10/2023', status: 'Concluído' },
  { id: 'al3', staffName: 'Mariana Costa', staffRole: 'Prof. Braille', schoolName: 'E.M. Monteiro Lobato', date: '22/10/2023', status: 'Pendente' }
];
