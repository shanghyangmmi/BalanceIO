using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPayroll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeCompensations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContactId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaseSalary = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    FixedAllowance = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    JkkRate = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    BpjsKetenagakerjaan = table.Column<bool>(type: "boolean", nullable: false),
                    BpjsPension = table.Column<bool>(type: "boolean", nullable: false),
                    BpjsKesehatan = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeCompensations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeCompensations_Contacts_ContactId",
                        column: x => x.ContactId,
                        principalTable: "Contacts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PayrollRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    PostingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalGross = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    TotalPph21 = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    TotalEmployeeBpjs = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    TotalEmployerBpjs = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    TotalNetPay = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PayrollLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContactId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Nik = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    PtkpStatus = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    TerCategory = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false),
                    BaseSalary = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    FixedAllowance = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    OtherEarnings = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployerJkk = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployerJkm = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployerJht = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployerJp = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployerKesehatan = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployeeJht = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployeeJp = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    EmployeeKesehatan = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    TaxableGross = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    TerRate = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    Pph21Method = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Pph21 = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    NetPay = table.Column<decimal>(type: "numeric(19,4)", nullable: false),
                    Warning = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollLines_PayrollRuns_PayrollRunId",
                        column: x => x.PayrollRunId,
                        principalTable: "PayrollRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeCompensations_CompanyId_ContactId",
                table: "EmployeeCompensations",
                columns: new[] { "CompanyId", "ContactId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeCompensations_ContactId",
                table: "EmployeeCompensations",
                column: "ContactId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollLines_ContactId",
                table: "PayrollLines",
                column: "ContactId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollLines_PayrollRunId",
                table: "PayrollLines",
                column: "PayrollRunId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollRuns_CompanyId_Year_Month",
                table: "PayrollRuns",
                columns: new[] { "CompanyId", "Year", "Month" },
                unique: true,
                filter: "\"Status\" <> 2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeCompensations");

            migrationBuilder.DropTable(
                name: "PayrollLines");

            migrationBuilder.DropTable(
                name: "PayrollRuns");
        }
    }
}
