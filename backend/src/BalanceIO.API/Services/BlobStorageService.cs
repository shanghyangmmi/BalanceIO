using Amazon.S3;
using Amazon.S3.Transfer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace BalanceIO.API.Services;

/// <summary>
/// Hybrid Blob & File Storage Service:
/// - Supports Amazon S3 / MinIO object storage when configured
/// - Seamlessly falls back to isolated local disk storage (./uploads) in development/offline modes
/// - Provides streaming for PDF/Image inline previews and downloads
/// </summary>
public class BlobStorageService
{
    private readonly IConfiguration _configuration;
    private readonly IAmazonS3? _s3Client;
    private readonly string _bucketName;
    private readonly string _localUploadDirectory;
    private readonly bool _useLocalStorage;
    private readonly bool _allowLocalDisk;

    public BlobStorageService(IConfiguration configuration, IHostEnvironment environment)
    {
        _configuration = configuration;

        // Local disk is the development store. Anywhere else it has to be
        // asked for (Storage:AllowLocalDisk, for a server with a persistent
        // volume): a deployment replaces the application directory, and
        // evidence written there would go with it without anyone being told.
        _allowLocalDisk = configuration.GetValue<bool?>("Storage:AllowLocalDisk") ?? environment.IsDevelopment();

        var awsConfig = _configuration.GetSection("AWS");
        _bucketName = awsConfig["BucketName"] ?? "balanceio-uploads";
        
        var accessKey = awsConfig["AccessKey"];
        var secretKey = awsConfig["SecretKey"];
        var serviceUrl = awsConfig["ServiceURL"];

        _localUploadDirectory = Path.Combine(AppContext.BaseDirectory, "uploads");
        if (!Directory.Exists(_localUploadDirectory))
        {
            Directory.CreateDirectory(_localUploadDirectory);
        }

        if (!string.IsNullOrWhiteSpace(accessKey) && !string.IsNullOrWhiteSpace(secretKey) && !string.IsNullOrWhiteSpace(serviceUrl))
        {
            try
            {
                var config = new AmazonS3Config
                {
                    ServiceURL = serviceUrl,
                    ForcePathStyle = true
                };

                _s3Client = new AmazonS3Client(accessKey, secretKey, config);
                _useLocalStorage = false;
            }
            catch
            {
                _useLocalStorage = true;
            }
        }
        else
        {
            _useLocalStorage = true;
        }
    }

    /// <summary>
    /// Whether an upload has somewhere durable to go: object storage, or
    /// local disk where that is allowed. Callers refuse uploads when it is
    /// false rather than accept a file that will not be kept.
    /// </summary>
    public bool IsAvailable => !_useLocalStorage || _allowLocalDisk;

    /// <summary>True when uploads are written to <see cref="LocalUploadDirectory"/>.</summary>
    public bool UsesLocalDisk => _useLocalStorage && _allowLocalDisk;

    public string LocalUploadDirectory => _localUploadDirectory;

    /// <summary>
    /// Uploads a file stream and returns (storageKey, publicUrl)
    /// </summary>
    public async Task<(string storageKey, string publicUrl)> UploadFileAsync(Stream fileStream, string fileName, string contentType)
    {
        var sanitizedFileName = Path.GetFileName(fileName);
        var extension = Path.GetExtension(sanitizedFileName);
        var uniqueKey = $"{Guid.NewGuid():N}_{sanitizedFileName}";

        if (!_useLocalStorage && _s3Client != null)
        {
            try
            {
                var fileTransferUtility = new TransferUtility(_s3Client);
                var request = new TransferUtilityUploadRequest
                {
                    InputStream = fileStream,
                    Key = uniqueKey,
                    BucketName = _bucketName,
                    CannedACL = S3CannedACL.PublicRead,
                    ContentType = contentType
                };

                await fileTransferUtility.UploadAsync(request);

                var serviceUrl = _configuration["AWS:ServiceURL"]?.TrimEnd('/');
                var url = $"{serviceUrl}/{_bucketName}/{uniqueKey}";
                return (uniqueKey, url);
            }
            catch
            {
                // Fallback to local storage on S3 failure
            }
        }

        // Local Disk Storage
        var localFilePath = Path.Combine(_localUploadDirectory, uniqueKey);
        using (var destinationStream = new FileStream(localFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await fileStream.CopyToAsync(destinationStream);
        }

        var localUrl = $"/api/attachments/file/{uniqueKey}";
        return (uniqueKey, localUrl);
    }

    /// <summary>
    /// Retrieves a readable file stream for previews or downloads
    /// </summary>
    public async Task<(Stream stream, string contentType)?> GetFileStreamAsync(string storagePath, string defaultContentType = "application/octet-stream")
    {
        if (!_useLocalStorage && _s3Client != null)
        {
            try
            {
                var response = await _s3Client.GetObjectAsync(_bucketName, storagePath);
                return (response.ResponseStream, response.Headers.ContentType ?? defaultContentType);
            }
            catch
            {
                // Fallback to check local
            }
        }

        var localPath = Resolve(storagePath);
        if (localPath != null && File.Exists(localPath))
        {
            var stream = new FileStream(localPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return (stream, defaultContentType);
        }

        return null;
    }

    /// <summary>
    /// Resolves a storage key to a path inside the upload directory, or
    /// null if it would escape.
    ///
    /// Path.Combine is not a containment check. Given an absolute second
    /// argument it discards the first and returns the absolute path
    /// outright, so a storage key of "C:/Windows/win.ini" would have been
    /// read as-is; "../.." walks out the same way. Nothing currently
    /// reaches here with a caller-controlled key - the route that did was
    /// removed - but the guard belongs in the service, where the next
    /// caller will inherit it rather than have to remember it.
    /// </summary>
    private string? Resolve(string storagePath)
    {
        if (string.IsNullOrWhiteSpace(storagePath)) return null;

        var root = Path.GetFullPath(_localUploadDirectory);
        var candidate = Path.GetFullPath(Path.Combine(root, storagePath));

        var rooted = root.EndsWith(Path.DirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;

        return candidate.StartsWith(rooted, StringComparison.OrdinalIgnoreCase)
            ? candidate
            : null;
    }

    /// <summary>
    /// Deletes a file by its storage key or URL
    /// </summary>
    public async Task DeleteFileAsync(string storagePathOrUrl)
    {
        if (string.IsNullOrEmpty(storagePathOrUrl)) return;

        var key = Path.GetFileName(storagePathOrUrl);

        if (!_useLocalStorage && _s3Client != null)
        {
            try
            {
                await _s3Client.DeleteObjectAsync(_bucketName, key);
            }
            catch
            {
                // Ignored if local
            }
        }

        var localPath = Path.Combine(_localUploadDirectory, key);
        if (File.Exists(localPath))
        {
            File.Delete(localPath);
        }
    }
}
