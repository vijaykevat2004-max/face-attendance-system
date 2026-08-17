-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "employeeMustChangePin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "employeePinHash" TEXT,
ADD COLUMN     "employeePortalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "employeeSessionVersion" INTEGER NOT NULL DEFAULT 0;

