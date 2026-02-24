export function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    participantType: user.participantType,
    collegeName: user.collegeName,
    contactNumber: user.contactNumber,
    organizerName: user.organizerName,
    category: user.category,
    description: user.description,
    contactEmail: user.contactEmail,
    preferences: user.preferences,
    onboardingCompleted: user.onboardingCompleted,
    disabled: user.disabled,
    archived: user.archived
  };
}

export function publicEvent(event) {
  if (!event) return null;
  return {
    id: event._id,
    name: event.name,
    description: event.description,
    type: event.type,
    organizer: event.organizer,
    eligibility: event.eligibility,
    registrationDeadline: event.registrationDeadline,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationLimit: event.registrationLimit,
    registrationFee: event.registrationFee,
    teamBased: event.teamBased,
    maxTeamSize: event.maxTeamSize,
    tags: event.tags,
    customForm: event.customForm,
    formLocked: event.formLocked,
    merchandise: event.merchandise,
    status: event.status,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
}
