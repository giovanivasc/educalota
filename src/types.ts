
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
export type RequestStatus = 'DRAFT' | 'PENDING_CEES' | 'RETURNED' | 'SCHEDULED' | 'IN_PROGRESS' | 'INCONCLUSIVE' | 'CANCELLED' | 'COMPLETED';

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
  assessor_2_id?: string;
  final_report_text?: string;
  final_report_file_url?: string;
  history?: any[];
  first_received_at?: string;

  // Novos campos de fluxo de avaliação
  anamnesis_data?: any;
  pedagogical_listening_data?: any;
  classroom_observation_data?: any;
  individual_evaluation_data?: any;
  specialized_support?: string;
  class_id?: string;
  unlock_requested?: boolean;
  unlock_reason?: string;

  created_at: string;
  updated_at: string;
}

export interface CeesActivity {
  id: string;
  title: string;
  activity_type: string;
  location: string;
  start_time: string;
  end_time: string;
  color: string;
  participants: string[];
  created_by?: string;
}

export interface CeesAbsence {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export interface AnamnesisData {
  // 1. Identificação
  attendanceDate: string;
  attendanceLocation: 'CEES' | 'Unidade de Ensino' | '';
  
  // 2. Dados da Família
  motherName: string; motherContact: string;
  fatherName: string; fatherContact: string;
  respName: string; respContact: string;
  hasSiblings: string; siblingsCount: string;
  familyComposition: string[]; // ['Mãe', 'Pai', 'Irmãos', 'Tios', 'Avós', 'Outros']
  familyCompositionOther: string;
  familyDeficiency: string; familyDeficiencyDetails: string;
  fosterCare: string; // Sim / Não
  socioEducative: string; socioEducativeType: string; // Liberdade Assistida / Prestação de Serviço
  govPrograms: string[]; govProgramsOther: string;
  financialStatus: string;

  // 3. Gestação e Parto
  familyPlanning: string;
  prenatal: string; prenatalStartMonth: string;
  vaccines: string;
  motherEmotional: string;
  pregnancyEating: string;
  pregnancyDiseases: string; pregnancyDiseasesDetails: string;
  beforeBirth24h: string[]; beforeBirthOther: string;
  gestationTime: string;
  birthType: string; // Normal / Cesárea
  birthComplications: string; birthComplicationsDetails: string;
  riskPregnancy: string;
  atBirthCried: string; atBirthJaundice: string; atBirthAnoxia: string; atBirthCyanotic: string;
  incubator: string;
  testsDone: string[]; testsAlterations: string; testsAlterationsDetails: string;

  // 4. Desenvolvimento
  devHead: string; devSit: string; devCrawl: string; devStand: string; devWalk: string; devBabble: string; devWords: string;
  habitsPacifier: string; habitsThumb: string; habitsBreastMilk: string;
  foodComplement: boolean; foodSubstitute: boolean;
  foodIntroduction: string; // Antes dos 6 meses / Após os 6 meses

  // 5. Dados Adicionais Atuais
  hasDeficiency: string; deficiencyCid: string;
  selectiveEating: string; selectiveEatingDetails: string;
  restrictedEating: string; restrictedEatingDetails: string;
  sleepAgitated: string; // Sim / Não / Às vezes
  constantCrying: string;
  bitesNails: string; bitesNailsFreq: string;
  bruxism: string;
  otherManipulations: string;
  shortFrenulum: string;
  surgery: string; surgeryDetails: string;
  trauma: string; traumaDetails: string;
  fainting: string;
  convulsions: string;
  currentDiseases: string; currentDiseasesDetails: string;
  clinicalCare: string[]; clinicalCareOther: string;
  medications: string; medicationsDetails: string; medicationsTime: string[];
  relationship: string[]; relationshipOther: string;
  tendencyToFall: string; tendencyToInjure: string; tendencyToSelfHarm: string;
  objectManipulationDifficulty: string; otherDifficulties: string;
  communicationType: string[]; // Verbal, Não Verbal, Mista, Sinalizada
  screenTimeExcess: string; screenTimeDetails: string;
  schoolAdaptationLimitation: string; schoolAdaptationDetails: string;

  // 6. AVDs
  avdFeeding: string; avdDressing: string; avdHygiene: string; avdBladder: string; avdBowel: string;
}
