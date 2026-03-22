namespace backend.Models;

public record ReviewRequest
{
    public string ReviewText { get; init; } = "";
    public string BusinessTone { get; init; } = "";
    public string BusinessDescription { get; init; } = "";
}