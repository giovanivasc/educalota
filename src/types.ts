
export enum UserRole {
  ADMIN = 'ADMIN',
  DIRETOR = 'DIRETOR',
  SECRETARIO = 'SECRETARIO',
  COORDENADOR = 'COORDENADOR',
  ASSESSOR = 'ASSESSOR'
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
  codigo_escola?: string;
  telefone_diretor?: string;
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
  possui_laudo?: boolean;
  cid_hipotese?: string;
}

export interface AllotmentRecord {
  id: string;
  staffName: string;
  staffRole: string;
  schoolName: string;
  date: string;
  status: 'Concluído' | 'Pendente';
}

export type RequestType = 'AVALIACAO' | 'REAVALIACAO' | 'INTERVENCAO';
export type RequestStatus = 'DRAFT' | 'PENDING_CEES' | 'RETURNED' | 'SCHEDULED' | 'COMPLETED';

export interface EvaluationRequest {
  id: string;
  protocol_number: string;
  request_type: RequestType;
  school_id: string;
  student_id?: string;

  student_name: string;
  student_birth_date: string;
  student_is_new: boolean;
  student_previous_school?: string;
  student_level?: string;
  student_year_stage?: string;
  student_class?: string;
  student_shift?: string;
  students_in_class?: number;
  regular_teacher_name?: string;
  has_specialized_professional: boolean;
  specialized_professional_type?: string;
  specialized_professional_name?: string;
  has_other_special_ed_students: boolean;
  other_special_ed_students_count?: number;
  other_special_ed_students_disabilities?: string;
  responsible_name: string;
  responsible_phone: string;

  pedagogical_observations?: string;
  relational_observations?: string;
  methodological_observations?: string;

  authorization_file_url?: string;
  status: RequestStatus;
  return_reason?: string;
  evaluation_date?: string;
  assessor_id?: string;
  final_report_text?: string;
  final_report_file_url?: string;

  created_at: string;
  updated_at: string;
}
