export const employeeSensitiveFields = [
  'cpf', 'rg', 'emitterOrgan', 'birthDate', 'maritalStatus', 'phone',
  'personalEmail', 'emergencyContactName', 'emergencyContactPhone',
  'zipCode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'country',
] as const

export function hasSensitiveEmployeeFields(payload: Record<string, unknown>) {
  return employeeSensitiveFields.some((field) => Object.prototype.hasOwnProperty.call(payload, field))
}
