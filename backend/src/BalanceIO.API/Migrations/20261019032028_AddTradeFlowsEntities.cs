using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTradeFlowsEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "SalesOrders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "SalesOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "SalesOrders",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "SalesOrders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "SalesOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "SalesOrderLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "GoodsReceipts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "GoodsReceipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "GoodsReceipts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "GoodsReceipts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "GoodsReceipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "GoodsReceipts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseId",
                table: "GoodsReceipts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "FundTransfers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "FundTransfers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "FundTransfers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "FundTransfers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "FundTransfers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "FundTransfers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "DeliveryOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "DeliveryOrders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "DeliveryOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "DeliveryOrders",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "DeliveryOrders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "DeliveryOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseId",
                table: "DeliveryOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "DebitNotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "DebitNotes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "DebitNotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "DebitNotes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "DebitNotes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "DebitNotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ReturnToInventory",
                table: "DebitNotes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseId",
                table: "DebitNotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "DebitNoteLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "CreditNotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "CreditNotes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "CreditNotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "CreditNotes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "CreditNotes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "CreditNotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ReturnToInventory",
                table: "CreditNotes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseId",
                table: "CreditNotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "CreditNoteLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalesOrders_CompanyId_OrderNumber",
                table: "SalesOrders",
                columns: new[] { "CompanyId", "OrderNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalesOrderLines_CostCenterId",
                table: "SalesOrderLines",
                column: "CostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceipts_CompanyId_ReceiptNumber",
                table: "GoodsReceipts",
                columns: new[] { "CompanyId", "ReceiptNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceipts_WarehouseId",
                table: "GoodsReceipts",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_FundTransfers_CompanyId_TransferNumber",
                table: "FundTransfers",
                columns: new[] { "CompanyId", "TransferNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryOrders_CompanyId_DeliveryNumber",
                table: "DeliveryOrders",
                columns: new[] { "CompanyId", "DeliveryNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryOrders_WarehouseId",
                table: "DeliveryOrders",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_DebitNotes_CompanyId_DebitNoteNumber",
                table: "DebitNotes",
                columns: new[] { "CompanyId", "DebitNoteNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DebitNotes_WarehouseId",
                table: "DebitNotes",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_DebitNoteLines_CostCenterId",
                table: "DebitNoteLines",
                column: "CostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_CreditNotes_CompanyId_CreditNoteNumber",
                table: "CreditNotes",
                columns: new[] { "CompanyId", "CreditNoteNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CreditNotes_WarehouseId",
                table: "CreditNotes",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_CreditNoteLines_CostCenterId",
                table: "CreditNoteLines",
                column: "CostCenterId");

            migrationBuilder.AddForeignKey(
                name: "FK_CreditNoteLines_CostCenters_CostCenterId",
                table: "CreditNoteLines",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CreditNotes_Companies_CompanyId",
                table: "CreditNotes",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CreditNotes_Warehouses_WarehouseId",
                table: "CreditNotes",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DebitNoteLines_CostCenters_CostCenterId",
                table: "DebitNoteLines",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DebitNotes_Companies_CompanyId",
                table: "DebitNotes",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DebitNotes_Warehouses_WarehouseId",
                table: "DebitNotes",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryOrders_Companies_CompanyId",
                table: "DeliveryOrders",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryOrders_Warehouses_WarehouseId",
                table: "DeliveryOrders",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FundTransfers_Companies_CompanyId",
                table: "FundTransfers",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GoodsReceipts_Companies_CompanyId",
                table: "GoodsReceipts",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GoodsReceipts_Warehouses_WarehouseId",
                table: "GoodsReceipts",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesOrderLines_CostCenters_CostCenterId",
                table: "SalesOrderLines",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesOrders_Companies_CompanyId",
                table: "SalesOrders",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CreditNoteLines_CostCenters_CostCenterId",
                table: "CreditNoteLines");

            migrationBuilder.DropForeignKey(
                name: "FK_CreditNotes_Companies_CompanyId",
                table: "CreditNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_CreditNotes_Warehouses_WarehouseId",
                table: "CreditNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_DebitNoteLines_CostCenters_CostCenterId",
                table: "DebitNoteLines");

            migrationBuilder.DropForeignKey(
                name: "FK_DebitNotes_Companies_CompanyId",
                table: "DebitNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_DebitNotes_Warehouses_WarehouseId",
                table: "DebitNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryOrders_Companies_CompanyId",
                table: "DeliveryOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryOrders_Warehouses_WarehouseId",
                table: "DeliveryOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_FundTransfers_Companies_CompanyId",
                table: "FundTransfers");

            migrationBuilder.DropForeignKey(
                name: "FK_GoodsReceipts_Companies_CompanyId",
                table: "GoodsReceipts");

            migrationBuilder.DropForeignKey(
                name: "FK_GoodsReceipts_Warehouses_WarehouseId",
                table: "GoodsReceipts");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesOrderLines_CostCenters_CostCenterId",
                table: "SalesOrderLines");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesOrders_Companies_CompanyId",
                table: "SalesOrders");

            migrationBuilder.DropIndex(
                name: "IX_SalesOrders_CompanyId_OrderNumber",
                table: "SalesOrders");

            migrationBuilder.DropIndex(
                name: "IX_SalesOrderLines_CostCenterId",
                table: "SalesOrderLines");

            migrationBuilder.DropIndex(
                name: "IX_GoodsReceipts_CompanyId_ReceiptNumber",
                table: "GoodsReceipts");

            migrationBuilder.DropIndex(
                name: "IX_GoodsReceipts_WarehouseId",
                table: "GoodsReceipts");

            migrationBuilder.DropIndex(
                name: "IX_FundTransfers_CompanyId_TransferNumber",
                table: "FundTransfers");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryOrders_CompanyId_DeliveryNumber",
                table: "DeliveryOrders");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryOrders_WarehouseId",
                table: "DeliveryOrders");

            migrationBuilder.DropIndex(
                name: "IX_DebitNotes_CompanyId_DebitNoteNumber",
                table: "DebitNotes");

            migrationBuilder.DropIndex(
                name: "IX_DebitNotes_WarehouseId",
                table: "DebitNotes");

            migrationBuilder.DropIndex(
                name: "IX_DebitNoteLines_CostCenterId",
                table: "DebitNoteLines");

            migrationBuilder.DropIndex(
                name: "IX_CreditNotes_CompanyId_CreditNoteNumber",
                table: "CreditNotes");

            migrationBuilder.DropIndex(
                name: "IX_CreditNotes_WarehouseId",
                table: "CreditNotes");

            migrationBuilder.DropIndex(
                name: "IX_CreditNoteLines_CostCenterId",
                table: "CreditNoteLines");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "SalesOrderLines");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "FundTransfers");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "FundTransfers");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "FundTransfers");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "FundTransfers");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "FundTransfers");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "FundTransfers");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "DeliveryOrders");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "DeliveryOrders");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "DeliveryOrders");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "DeliveryOrders");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "DeliveryOrders");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "DeliveryOrders");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "DeliveryOrders");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "ReturnToInventory",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "DebitNotes");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "DebitNoteLines");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "ReturnToInventory",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "CreditNoteLines");
        }
    }
}
