
export enum UserRole {
  ADMIN = 'ADMIN',
  DIRETOR = 'DIRETOR',
  SECRETARIO = 'SECRETARIO',
  COORDENADOR = 'COORDENADOR',
  VISITANTE = 'VISITANTE'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  permissions?: string[];
}

export interface School {
  id: string;
  name: string;
  location: string;
  description: string;
  studentsCount: number;
  classesCount: number;
  imageUrl?: string;
  region: string;
  active: boolean;
  directorName?: string;
  viceDirectorName?: string;
}

export interface Class {
  id: string;
  schoolId: string;
  modality: string;
  year: number;
  series: string; // "5º Ano", "Ensino Médio 1"
  section: string; // "A", "B", "101"
  shift: 'Manhã' | 'Tarde' | 'Noite' | 'Integral';
  obs?: string;
  studentsIds: string[];
  staffIds: string[];
}

export interface Staff {
  id: string;
  name: string;
  registration: string;
  role: 'Professor AEE' | 'Intérprete' | 'Apoio' | 'Psicólogo';
  contractType: 'Efetivo' | 'Efetivo Função' | 'Efetivo Cargo' | 'Temporário' | 'Contrato' | 'Municipalizado';
  hoursTotal: number;
  hoursAvailable: number;
  avatar?: string;
  observations?: string;
}

export interface Student {
  id: string;
  name: string;
  birthDate: string;
  series: string;
  cid: string;
  specialGroup: string;
  needsSupport: string[];
  additionalInfo?: string;
  schoolId?: string;
}

export interface AllotmentRecord {
  id: string;
  staffName: string;
  staffRole: string;
  schoolName: string;
  date: string;
  status: 'Concluído' | 'Pendente';
}
