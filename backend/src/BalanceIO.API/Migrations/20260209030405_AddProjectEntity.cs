using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                // Idempotent add for PasswordResetToken
                migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='PasswordResetToken') THEN
                            ALTER TABLE ""Users"" ADD ""PasswordResetToken"" text;
                        END IF;
                      END $$;");

                // Idempotent add for PasswordResetTokenExpiresAt
                migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='PasswordResetTokenExpiresAt') THEN
                            ALTER TABLE ""Users"" ADD ""PasswordResetTokenExpiresAt"" timestamp with time zone;
                        END IF;
                      END $$;");

                // Idempotent add ProjectId to SalesInvoices
                migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SalesInvoices' AND column_name='ProjectId') THEN
                            ALTER TABLE ""SalesInvoices"" ADD ""ProjectId"" uuid;
                        END IF;
                      END $$;");

                // Idempotent add ProjectId to JournalEntries
                migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='JournalEntries' AND column_name='ProjectId') THEN
                            ALTER TABLE ""JournalEntries"" ADD ""ProjectId"" uuid;
                        END IF;
                      END $$;");

                // Idempotent Create Table Projects
                migrationBuilder.Sql(
                    @"CREATE TABLE IF NOT EXISTS ""Projects"" (
                        ""Id"" uuid NOT NULL CONSTRAINT ""PK_Projects"" PRIMARY KEY,
                        ""Name"" character varying(100) NOT NULL,
                        ""Code"" character varying(20),
                        ""Description"" character varying(500),
                        ""Status"" integer NOT NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL,
                        ""UpdatedAt"" timestamp with time zone
                    );");

                // Idempotent Create Index IX_SalesInvoices_ProjectId
                migrationBuilder.Sql(
                    @"DO $$
                      BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'IX_SalesInvoices_ProjectId' AND n.nspname = 'public') THEN
                            CREATE INDEX ""IX_SalesInvoices_ProjectId"" ON ""SalesInvoices"" (""ProjectId"");
                        END IF;
                      END $$;");

                // Idempotent Create Index IX_JournalEntries_ProjectId
                migrationBuilder.Sql(
                    @"DO $$
                      BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'IX_JournalEntries_ProjectId' AND n.nspname = 'public') THEN
                            CREATE INDEX ""IX_JournalEntries_ProjectId"" ON ""JournalEntries"" (""ProjectId"");
                        END IF;
                      END $$;");

                // Idempotent Foreign Keys
                migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_JournalEntries_Projects_ProjectId') THEN
                            ALTER TABLE ""JournalEntries"" ADD CONSTRAINT ""FK_JournalEntries_Projects_ProjectId"" FOREIGN KEY (""ProjectId"") REFERENCES ""Projects"" (""Id"");
                        END IF;
                      END $$;");

                migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_SalesInvoices_Projects_ProjectId') THEN
                            ALTER TABLE ""SalesInvoices"" ADD CONSTRAINT ""FK_SalesInvoices_Projects_ProjectId"" FOREIGN KEY (""ProjectId"") REFERENCES ""Projects"" (""Id"");
                        END IF;
                      END $$;");
            }
            else
            {
                migrationBuilder.AddColumn<string>(
                    name: "PasswordResetToken",
                    table: "Users",
                    nullable: true);

                migrationBuilder.AddColumn<DateTime>(
                    name: "PasswordResetTokenExpiresAt",
                    table: "Users",
                    nullable: true);

                migrationBuilder.AddColumn<Guid>(
                    name: "ProjectId",
                    table: "SalesInvoices",
                    nullable: true);

                migrationBuilder.AddColumn<Guid>(
                    name: "ProjectId",
                    table: "JournalEntries",
                    nullable: true);

                migrationBuilder.CreateTable(
                    name: "Projects",
                    columns: table => new
                    {
                        Id = table.Column<Guid>(type: "TEXT", nullable: false),
                        Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                        Code = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                        Description = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                        Status = table.Column<int>(type: "INTEGER", nullable: false),
                        CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                        UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                    },
                    constraints: table =>
                    {
                        table.PrimaryKey("PK_Projects", x => x.Id);
                    });

                migrationBuilder.CreateIndex(
                    name: "IX_SalesInvoices_ProjectId",
                    table: "SalesInvoices",
                    column: "ProjectId");

                migrationBuilder.CreateIndex(
                    name: "IX_JournalEntries_ProjectId",
                    table: "JournalEntries",
                    column: "ProjectId");

                migrationBuilder.AddForeignKey(
                    name: "FK_JournalEntries_Projects_ProjectId",
                    table: "JournalEntries",
                    column: "ProjectId",
                    principalTable: "Projects",
                    principalColumn: "Id");

                migrationBuilder.AddForeignKey(
                    name: "FK_SalesInvoices_Projects_ProjectId",
                    table: "SalesInvoices",
                    column: "ProjectId",
                    principalTable: "Projects",
                    principalColumn: "Id");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_JournalEntries_Projects_ProjectId",
                table: "JournalEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesInvoices_Projects_ProjectId",
                table: "SalesInvoices");

            migrationBuilder.DropTable(
                name: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_SalesInvoices_ProjectId",
                table: "SalesInvoices");

            migrationBuilder.DropIndex(
                name: "IX_JournalEntries_ProjectId",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "PasswordResetToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PasswordResetTokenExpiresAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "JournalEntries");
        }
    }
}
